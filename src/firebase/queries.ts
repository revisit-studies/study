import {doc,setDoc,getDoc} from 'firebase/firestore';
import {useIdentifiers} from '../store/hooks/useIdentifiers';
import firebase from 'firebase/compat';
import Firestore = firebase.firestore.Firestore;
// const fb = FIREBASE.fStore;
// const app = FIREBASE.app;
// const studyIdentifiers = useIdentifiers();
// const pid = studyIdentifiers?.pid || 'test';
// const studyID = studyIdentifiers?.study_id || 'test';
// const sessionID = studyIdentifiers?.session_id || 'test';
export const addExpToUser = async (fb:any,studyID : string, pid : string, signature : string) => {
    const data = {[studyID]: {'studyID': studyID, 'signature': signature, 'timeStamp': Date.now()}};
    try {
        const docRef = setDoc(doc(fb, 'users', pid), data, {merge: true});
        return docRef;
    } catch (e) {
        console.error('Firebase error adding user: ', e);
    }
};

// export const getUser = async (id: string) => {
//     try {
//         const docRef = doc(fb, 'users', id);
//         const docSnap = await getDoc(docRef);
//         if (docSnap.exists()) {
//             return docSnap.data();
//         } else {
//             return null;
//         }
//     } catch (e) {
//         console.error('Firebase error loading user: ', e);
//     }
// };
//
// export const saveTrial = async (trialID: string, currentStep: string
//                                       ,answer:string | object, type:'trials' | 'practice' ) => {
//     const data = {[trialID]: {
//             'trialID': trialID,
//             'timeStamp': Date.now(),
//             'answer': answer,
//             'type': type,
//             'step': currentStep,
//             'expID': studyID,
//     }};
//     try {
//         const docRef = setDoc(doc(fb, studyID, pid), data, {merge: true});
//         return docRef;
//     } catch (e) {
//         console.error('Firebase error adding data: ', e);
//     }
// };
//
//
//
