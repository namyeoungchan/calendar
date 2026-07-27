import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SOLO_TEST_CONNECTION_CODE } from "./connection";
import { getDataConnectDb } from "./firebase-admin";
import type { CalendarEvent, ConnectionState } from "./types";
import { AccountMissingError, InputError } from "./validation";

type EventRow = CalendarEvent;

export async function listEvents(coupleId: string): Promise<CalendarEvent[]> {
  const response = await getDataConnectDb().executeQuery<
    { events: EventRow[] },
    { coupleId: string }
  >("ListEvents", { coupleId });
  return response.data.events.sort((a, b) =>
    `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`)
  );
}

async function getEvent(coupleId: string, id: string): Promise<CalendarEvent | null> {
  const response = await getDataConnectDb().executeQuery<
    { events: EventRow[] },
    { coupleId: string; id: string }
  >("GetEvent", { coupleId, id });
  return response.data.events[0] ?? null;
}

export async function createEvent(
  coupleId: string,
  event: Omit<CalendarEvent, "id">
): Promise<CalendarEvent> {
  const created = { id: randomUUID(), ...event };
  await getDataConnectDb().executeMutation<unknown, CalendarEvent & { coupleId: string }>(
    "CreateEvent",
    { coupleId, ...created }
  );
  return created;
}

export async function updateEvent(
  coupleId: string,
  id: string,
  event: Omit<CalendarEvent, "id">
): Promise<CalendarEvent | null> {
  if (!(await getEvent(coupleId, id))) return null;
  await getDataConnectDb().executeMutation<unknown, CalendarEvent>("UpdateEvent", {
    id,
    ...event,
  });
  return { id, ...event };
}

export async function deleteEvent(coupleId: string, id: string): Promise<boolean> {
  if (!(await getEvent(coupleId, id))) return false;
  await getDataConnectDb().executeMutation<unknown, { id: string }>("DeleteEvent", { id });
  return true;
}

export interface KakaoUserInput {
  id: string;
  nickname: string;
  email: string | null;
  profileImage: string | null;
}

export interface FirebaseUserInput {
  uid: string;
  email: string;
  nickname: string;
}

export interface AuthAccount {
  userId: string;
  coupleId: string;
  nickname: string;
}

interface AccountRow {
  id: string;
  nickname: string;
  userCode: string | null;
  couple: { id: string };
}

interface MemberRow {
  id: string;
  nickname: string;
  userCode: string | null;
  provider: string;
}

const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newUserCode(): string {
  let code: string;
  do {
    const bytes = randomBytes(10);
    code = Array.from(
      bytes,
      (byte) => USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length]
    ).join("");
  } while (code === SOLO_TEST_CONNECTION_CODE);
  return code;
}

async function getAccountRow(userId: string): Promise<AccountRow | null> {
  const response = await getDataConnectDb().executeQuery<
    { user: AccountRow | null },
    { userId: string }
  >("GetKakaoUser", { userId });
  return response.data.user;
}

async function getAccount(userId: string): Promise<AuthAccount | null> {
  const user = await getAccountRow(userId);
  return user
    ? { userId: user.id, coupleId: user.couple.id, nickname: user.nickname }
    : null;
}

async function findAccountByCode(userCode: string): Promise<AccountRow | null> {
  const response = await getDataConnectDb().executeQuery<
    { users: AccountRow[] },
    { userCode: string }
  >("GetUserByCode", { userCode });
  return response.data.users[0] ?? null;
}

async function listCoupleMembers(coupleId: string): Promise<MemberRow[]> {
  const response = await getDataConnectDb().executeQuery<
    { users: MemberRow[] },
    { coupleId: string }
  >("GetCoupleMembers", { coupleId });
  return response.data.users;
}

async function ensureUserCode(userId: string): Promise<string> {
  const account = await getAccountRow(userId);
  if (!account) throw new AccountMissingError();
  if (account.userCode) return account.userCode;

  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const userCode = newUserCode();
    if (await findAccountByCode(userCode)) continue;
    try {
      await getDataConnectDb().executeMutation<
        unknown,
        { userId: string; userCode: string }
      >("SetUserCode", { userId, userCode });
      return userCode;
    } catch (error) {
      lastError = error;
      const raced = await getAccountRow(userId);
      if (raced?.userCode) return raced.userCode;
    }
  }
  throw lastError ?? new Error("사용자 코드를 만들지 못했습니다.");
}

export async function getConnectionState(
  userId: string,
  coupleId: string
): Promise<ConnectionState> {
  const [userCode, members] = await Promise.all([
    ensureUserCode(userId),
    listCoupleMembers(coupleId),
  ]);
  const partner = members.find((member) => member.id !== userId) ?? null;
  return {
    connected: members.length === 2 && Boolean(partner),
    user_code: userCode,
    partner: partner
      ? {
          id: partner.id,
          nickname: partner.nickname,
          is_test: partner.provider === "solo_test",
        }
      : null,
  };
}

export async function connectPartner(
  userId: string,
  sourceCoupleId: string,
  userCode: string
): Promise<{ coupleId: string; state: ConnectionState }> {
  if (userCode === SOLO_TEST_CONNECTION_CODE) {
    return connectSoloTestPartner(userId, sourceCoupleId);
  }

  const [sourceMembers, target] = await Promise.all([
    listCoupleMembers(sourceCoupleId),
    findAccountByCode(userCode),
  ]);
  if (sourceMembers.length !== 1 || sourceMembers[0]?.id !== userId) {
    throw new InputError("이미 다른 파트너와 연결된 계정입니다.");
  }
  if (!target) {
    throw new InputError("해당 사용자 코드를 찾지 못했습니다.");
  }
  if (target.id === userId) {
    throw new InputError("본인의 코드가 아닌 상대방의 코드를 입력해주세요.");
  }
  if (target.couple.id === sourceCoupleId) {
    throw new InputError("이미 같은 공간에 연결되어 있습니다.");
  }

  const targetMembers = await listCoupleMembers(target.couple.id);
  if (targetMembers.length !== 1 || targetMembers[0]?.id !== target.id) {
    throw new InputError("상대방이 이미 다른 사용자와 연결되어 있습니다.");
  }

  await getDataConnectDb().executeMutation<
    unknown,
    { userId: string; sourceCoupleId: string; targetCoupleId: string }
  >("JoinCouple", {
    userId,
    sourceCoupleId,
    targetCoupleId: target.couple.id,
  });

  return {
    coupleId: target.couple.id,
    state: await getConnectionState(userId, target.couple.id),
  };
}

async function connectSoloTestPartner(
  userId: string,
  coupleId: string
): Promise<{ coupleId: string; state: ConnectionState }> {
  const sourceMembers = await listCoupleMembers(coupleId);
  if (sourceMembers.length !== 1 || sourceMembers[0]?.id !== userId) {
    throw new InputError("이미 다른 파트너와 연결된 계정입니다.");
  }

  const testUserId = `solo_test_${createHash("sha256")
    .update(userId)
    .digest("hex")
    .slice(0, 24)}`;
  const existing = await getAccountRow(testUserId);
  if (existing) {
    if (existing.couple.id !== coupleId) {
      throw new InputError("테스트 파트너를 현재 공간에 연결하지 못했습니다.");
    }
    return { coupleId, state: await getConnectionState(userId, coupleId) };
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const testUserCode = newUserCode();
    if (await findAccountByCode(testUserCode)) continue;
    try {
      await getDataConnectDb().executeMutation<
        unknown,
        {
          userId: string;
          providerUserId: string;
          userCode: string;
          coupleId: string;
        }
      >("CreateSoloTestPartner", {
        userId: testUserId,
        providerUserId: `solo-test:${userId}`,
        userCode: testUserCode,
        coupleId,
      });
      return { coupleId, state: await getConnectionState(userId, coupleId) };
    } catch (error) {
      lastError = error;
      const raced = await getAccountRow(testUserId);
      if (raced?.couple.id === coupleId) {
        return { coupleId, state: await getConnectionState(userId, coupleId) };
      }
    }
  }
  throw lastError ?? new Error("테스트 파트너를 만들지 못했습니다.");
}

export async function disconnectSoloTestPartner(
  userId: string,
  coupleId: string
): Promise<ConnectionState> {
  const members = await listCoupleMembers(coupleId);
  const partner = members.find((member) => member.id !== userId);
  const expectedTestUserId = `solo_test_${createHash("sha256")
    .update(userId)
    .digest("hex")
    .slice(0, 24)}`;
  if (
    members.length !== 2 ||
    !partner ||
    partner.id !== expectedTestUserId ||
    partner.provider !== "solo_test"
  ) {
    throw new InputError("테스트 파트너 연결만 해제할 수 있습니다.");
  }

  await getDataConnectDb().executeMutation<unknown, { userId: string }>(
    "DeleteSoloTestPartner",
    { userId: partner.id }
  );
  return getConnectionState(userId, coupleId);
}

async function updateKakaoProfile(userId: string, input: KakaoUserInput): Promise<void> {
  await getDataConnectDb().executeMutation<
    unknown,
    {
      userId: string;
      nickname: string;
      email: string | null;
      profileImage: string | null;
    }
  >("UpdateKakaoUser", {
    userId,
    nickname: input.nickname,
    email: input.email,
    profileImage: input.profileImage,
  });
}

export async function findOrCreateKakaoUser(input: KakaoUserInput): Promise<AuthAccount> {
  const userId = `kakao_${input.id}`;
  const existing = await getAccount(userId);
  if (existing) {
    await updateKakaoProfile(userId, input);
    return { ...existing, nickname: input.nickname };
  }

  const coupleId = `couple_${input.id}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const userCode = newUserCode();
    if (await findAccountByCode(userCode)) continue;
    try {
      await getDataConnectDb().executeMutation<
        unknown,
        {
          userId: string;
          coupleId: string;
          providerUserId: string;
          userCode: string;
          nickname: string;
          email: string | null;
          profileImage: string | null;
        }
      >("CreateKakaoAccount", {
        userId,
        coupleId,
        providerUserId: input.id,
        userCode,
        nickname: input.nickname,
        email: input.email,
        profileImage: input.profileImage,
      });
      return { userId, coupleId, nickname: input.nickname };
    } catch (error) {
      lastError = error;
      const raced = await getAccount(userId);
      if (raced) {
        await updateKakaoProfile(userId, input);
        return { ...raced, nickname: input.nickname };
      }
    }
  }
  throw lastError ?? new Error("카카오 계정을 만들지 못했습니다.");
}

export async function findOrCreateFirebaseUser(
  input: FirebaseUserInput
): Promise<AuthAccount> {
  const userId = `firebase_${input.uid}`;
  const existing = await getAccount(userId);
  if (existing) {
    await getDataConnectDb().executeMutation<
      unknown,
      { userId: string; nickname: string; email: string }
    >("UpdateFirebaseUser", {
      userId,
      nickname: input.nickname,
      email: input.email,
    });
    return { ...existing, nickname: input.nickname };
  }

  const coupleId = `couple_firebase_${input.uid}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const userCode = newUserCode();
    if (await findAccountByCode(userCode)) continue;
    try {
      await getDataConnectDb().executeMutation<
        unknown,
        {
          userId: string;
          coupleId: string;
          providerUserId: string;
          userCode: string;
          nickname: string;
          email: string;
        }
      >("CreateFirebaseAccount", {
        userId,
        coupleId,
        providerUserId: `firebase:${input.uid}`,
        userCode,
        nickname: input.nickname,
        email: input.email,
      });
      return { userId, coupleId, nickname: input.nickname };
    } catch (error) {
      lastError = error;
      const raced = await getAccount(userId);
      if (raced) return raced;
    }
  }
  throw lastError ?? new Error("이메일 계정을 만들지 못했습니다.");
}
