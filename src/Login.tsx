import { getAuth, signInWithPopup, GoogleAuthProvider } from '@firebase/auth';
import { StorageEngine } from './storage/engines/StorageEngine';
import { useAuth } from './store/hooks/useAuth';

interface LoginProps {
  storageEngine: StorageEngine | undefined;
  admins:string[];
}

export function Login({
  storageEngine, admins,
}:LoginProps) {
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
          // ...
          login({
            name: googleUser.displayName,
            admin: true,
            email: googleUser.email,
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

  return <button type="button" onClick={signInWithGoogle}>CLICK TO LOGIN</button>;
}
