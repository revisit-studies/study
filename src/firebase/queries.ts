import {doc,setDoc,getDoc} from 'firebase/firestore';
import {FIREBASE, STUDY_ID} from '../store';

const fb = FIREBASE.fStore;
const app = FIREBASE.app;
export const addExpToUser = async (userId: string, expID: string) => {
    const data = {[expID]: {'expID': expID, 'timeStamp': Date.now()}};
    try {
        const docRef = setDoc(doc(fb, 'users', userId), data, {merge: true});
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

export const saveTrial = async (userId: string, expID: string, trialID: string, currentStep: string
                                      ,answer:string | object, type:'trials' | 'practice' ) => {
    const data = {[trialID]: {
            'trialID': trialID,
            'timeStamp': Date.now(),
            'answer': answer,
            'type': type,
            'step': currentStep,
            'expID': expID,
    }};
    try {
        const docRef = setDoc(doc(fb, expID, userId), data, {merge: true});
        return docRef;
    } catch (e) {
        console.error('Firebase error adding data: ', e);
    }
};



