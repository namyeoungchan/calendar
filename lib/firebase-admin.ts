import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getDataConnect, type DataConnect } from "firebase-admin/data-connect";

let firebaseApp: App | null = null;
let dataConnect: DataConnect | null = null;

function privateKey(): string | undefined {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey()) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

export function isDataConnectConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_DATA_CONNECT_SERVICE_ID &&
      process.env.FIREBASE_DATA_CONNECT_LOCATION &&
      process.env.FIREBASE_DATA_CONNECT_CONNECTOR_ID
  );
}

export function getFirebaseAdminApp(): App {
  if (firebaseApp) return firebaseApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const key = privateKey();
  const credential = serviceAccountJson
    ? cert(JSON.parse(serviceAccountJson))
    : projectId && clientEmail && key
      ? cert({ projectId, clientEmail, privateKey: key })
      : applicationDefault();

  firebaseApp =
    getApps()[0] ??
    initializeApp({
      credential,
      ...(projectId ? { projectId } : {}),
    });
  return firebaseApp;
}

export function getDataConnectDb(): DataConnect {
  if (dataConnect) return dataConnect;

  const serviceId = process.env.FIREBASE_DATA_CONNECT_SERVICE_ID;
  const location = process.env.FIREBASE_DATA_CONNECT_LOCATION;
  const connector = process.env.FIREBASE_DATA_CONNECT_CONNECTOR_ID;
  if (!serviceId || !location || !connector) {
    throw new Error(
      "FIREBASE_DATA_CONNECT_SERVICE_ID, FIREBASE_DATA_CONNECT_LOCATION, " +
        "FIREBASE_DATA_CONNECT_CONNECTOR_ID가 필요합니다."
    );
  }

  dataConnect = getDataConnect({ serviceId, location, connector }, getFirebaseAdminApp());
  return dataConnect;
}
