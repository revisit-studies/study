import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuth, signInWithPopup, GoogleAuthProvider } from '@firebase/auth';
import { StorageEngine } from './storage/engines/StorageEngine';
import { User } from './ProtectedRoute';

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
        const user = result.user;
        // IdP data available using getAdditionalUserInfo(result)
        // ...
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
    });
};

interface LoginProps {
  storageEngine: StorageEngine | undefined;
  user: User | undefined;
  setUser : React.Dispatch<React.SetStateAction<User|undefined>>;
  isAuth : boolean;
  setIsAuth: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Login({
  storageEngine, user, setUser, isAuth, setIsAuth,
}:LoginProps) {
  useEffect(() => {
    if (storageEngine) {
      if (storageEngine.getEngine() === 'firebase') {
        const currUser: User = {
          name: 'localName',
          admin: true,
          email: 'localEmail@example.com',
        };
        if (user && user.email !== currUser.email) {
          setUser(currUser);
        }
        setIsAuth(true);
      } else {
        const currUser: User = {
          name: 'localName',
          admin: true,
          email: 'localEmail@example.com',
        };
        if (user && user.email !== currUser.email) {
          setUser(currUser);
        }
        setIsAuth(true);
      }
    } else {
      if (user) {
        setUser(undefined);
      }
      setIsAuth(false);
    }
  }, [storageEngine, isAuth, user]);

  return isAuth ? <Navigate to="/" /> : <button type="button" onClick={signInWithGoogle}>CLICK TO LOGIN</button>;
}
