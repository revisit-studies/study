import {
  AppCheck,
  initializeAppCheck,
  ReCaptchaV3Provider,
} from '@firebase/app-check';
import { getAuth, signInAnonymously } from '@firebase/auth';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { Nullable } from '../parser/types';
import { RECAPTCHAV3TOKEN } from './constants';

// Your web app's Firebase configuration
// This is safe to commit
const firebaseConfig = {
  apiKey: 'AIzaSyAm9QtUgx1lYPDeE0vKLN-lK17WfUGVkLo',
  authDomain: 'revisit-utah.firebaseapp.com',
  projectId: 'revisit-utah',
  storageBucket: 'revisit-utah.appspot.com',
  messagingSenderId: '811568460432',
  appId: '1:811568460432:web:995f6b4f1fc8042b5dde15',
};

const fsConfig = {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
};

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

let _app: Nullable<FirebaseApp> = null;
let _appcheck: Nullable<AppCheck> = null;
let _fStore: Nullable<Firestore> = null;

/**
 * To develop locally:
 * First time you run the local server you will have a console log with App Check Debug Token
 * Copy this token and add it to app check settings in firebase. You can do it at the below link -
 * https://console.firebase.google.com/u/0/project/revisit-utah/appcheck/apps
 *
 * The App check token is mechanism we use to authenticate that our web-app is the one making requests. Requests from anywhere
 * else will result in authentication error. Debug token is required so that tokens don't need to be verified locally everytime.
 * For deployed version this should happen automatically. If you do not have access to firebase to add the token ---
 * contact Yiren, Kiran, Jack or Alex to get access
 */
export async function getFirestoreManager() {
  // Initialize Firebase. Get previous instance else create new.
  const app = _app || initializeApp(firebaseConfig);
  if (!_app) _app = app;

  // perform an app check to get authorized token
  if (!_appcheck)
    _appcheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHAV3TOKEN),
      isTokenAutoRefreshEnabled: true,
    });

  // create auth instance
  const auth = getAuth();

  // if current user not defined sign in
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const pid = auth.currentUser?.uid;

  if (!pid) throw new Error('Login failed with firebase');

  if (!_fStore) _fStore = initializeFirestore(app, fsConfig);

  return {
    pid,
    store: _fStore,
  };
}
