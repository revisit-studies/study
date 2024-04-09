import { useEffect } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider } from '@firebase/auth';
import { useAuth, User } from './store/hooks/useAuth';
import { useStorageEngine } from './store/storageEngineHooks';

interface LoginProps {
  admins:string[];
}

export function Login({ admins }:LoginProps) {
  const { login, logout } = useAuth();

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const auth = getAuth();
    signInWithPopup(auth, provider)
      .then((result) => {
        // This gives you a Google Access Token. You can use it to access the Google API.
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential !== null) {
          const token = credential.accessToken;
          // The signed-in user info.
          const googleUser = result.user;
          // IdP data available using getAdditionalUserInfo(result)
          // Determines Admin status
          const admin = (googleUser.email?.includes && admins.includes(googleUser.email)) ?? false;

          // Logs in user
          login({
            name: googleUser.displayName,
            email: googleUser.email,
            admin,
          });
        }
      }).catch((error) => {
        // Handle Errors here.
        const errorCode = error.code;
        const errorMessage = error.message;
        // The email of the user's account used.
        const email = error.customData.email;
        // The AuthCredential type that was used.
        const credential = GoogleAuthProvider.credentialFromError(error);
        // ...
        // Set authentication to false in this case.
        logout();
      });
  };

  const { storageEngine } = useStorageEngine();

  useEffect(() => {
    if (storageEngine?.getEngine() !== 'firebase') {
      // If not using firebase as storage engine, authenticate the user with a fake user with admin privileges.
      const currUser: User = {
        name: 'localName',
        admin: false,
        email: 'localEmail@example.com',
      };
      login(currUser);
    }
  }, [storageEngine]);

  return <button type="button" onClick={signInWithGoogle}>CLICK TO LOGIN</button>;
}
