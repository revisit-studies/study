import {
  AppCheck,
  initializeAppCheck,
  ReCaptchaV3Provider,
} from '@firebase/app-check';
import { getAuth, signInAnonymously } from '@firebase/auth';
import { FirebaseApp, FirebaseError, initializeApp } from 'firebase/app';
import {
  CACHE_SIZE_UNLIMITED,
  disableNetwork,
  enableNetwork,
  Firestore,
  FirestoreSettings,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { Nullable } from '../parser/types';
import { MODE, RECAPTCHAV3TOKEN } from './constants';
import { parse as hjsonParse } from 'hjson';

const fsConfig: FirestoreSettings = {
  localCache: persistentLocalCache({
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    tabManager: persistentMultipleTabManager(),
  }),
};

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

let _app: Nullable<FirebaseApp> = null;
let _appcheck: Nullable<AppCheck> = null;
let _pid = 'OFFLINE_ANON_USER';
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
export async function getFirestoreManager(_connect = true) {
  if (MODE === 'dev') {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  const firebaseConfig = hjsonParse(import.meta.env.VITE_FIREBASE_CONFIG);
  console.log('Firebase config', firebaseConfig);

  // Initialize Firebase. Get previous instance else create new.
  const app = _app || initializeApp(firebaseConfig);
  if (!_app) _app = app;

  function startFirestore() {
    return initializeFirestore(app, fsConfig);
  }
  if (!_fStore) _fStore = startFirestore();

  let connected = false;
  disableNetwork(_fStore);

  if (!_connect) {
    return {
      pid: _pid,
      connected,
      startFirestore,
      firestore: _fStore,
    };
  }

  try {
    // perform an app check to get authorized token
    // if failed throw
    if (!_appcheck) {
      _appcheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(RECAPTCHAV3TOKEN),
        isTokenAutoRefreshEnabled: false,
      });
    }

    // if current user not defined sign in
    // This creates an anonymous user with information persisted in cookies. Lost on clearing cookies.
    // Anything more will require a login functionality. We can implement this with FirebaseAuth.
    // create auth instance
    const auth = getAuth();

    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

    // If cannot get user, throw error.
    _pid = auth.currentUser?.uid || _pid;
    if (!_pid) throw new Error('Login failed with firebase');

    // set connected status to true
    connected = true;
    // enable network access to firestore
    enableNetwork(_fStore);
  } catch (err: unknown) {
    // Handle firebase errors gracefully
    if (err instanceof FirebaseError) {
      // if app check error, warn user
      if (err.code === 'appCheck/fetch-status-error') {
        console.warn(
          'App check request failed, please check if debug token is set properly if running locally. If accessing deployed version check if the domain has proper permissions. Running in offline mode, all data is stored locally.'
        );
      } else {
        // warn about any other error
        console.error(err);
      }
    } else {
      throw err;
    }
  }

  return {
    connected,
    pid: _pid,
    firestore: _fStore,
    startFirestore: () => (_fStore = startFirestore()),
  };
}

// Download all
