import {doc,setDoc,getDoc} from 'firebase/firestore';
import {user} from './types';
import {FIREBASE} from '../store';

const fb = FIREBASE.fStore;
const app = FIREBASE.app;
export const addUser = async (user: user) => {
    try {
        const docRef = setDoc(doc(fb, 'users', user.id), user, {merge: true});
        return docRef;
    } catch (e) {
        console.error('Firebase error adding user: ', e);
    }
};

export const getUser = async (id: string) => {
    try {
        const docRef = doc(fb, 'users', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null;
        }
    } catch (e) {
        console.error('Firebase error loading user: ', e);
    }
};


