import {doc,setDoc,getDoc} from 'firebase/firestore';


const saveToFB = async (fb:any, path:string, data:any, errMsg:string) => {
    try {
        const docRef = setDoc(doc(fb,path), data, {merge: true});
        return docRef;
    } catch (e) {
        console.error(errMsg, e);
    }
};
export const addExpToUser = async (fb:any,studyID : string, pid : string, signature : string) => {
    const data = {[studyID]: {'studyID': studyID, 'signature': signature, 'timeStamp': Date.now()}};
    const path = `$users/${pid}`;

    saveToFB(fb, path, data, 'Firebase error adding experiment to user: ');
};

export const saveTrialToFB = async (fb:any, pid:string, studyID:string, trialID: string, currentStep: string
                                      ,answer:string | object, type:'trials' | 'practice' ) => {

    const path = `${studyID}/${pid}`;
    const data = {[trialID]: {
            'trialID': trialID,
            'timeStamp': Date.now(),
            'answer': answer,
            'type': type,
            'step': currentStep,
            'expID': studyID,
    }};
   return saveToFB(fb, path, data, 'Firebase error adding trial: ');
};

export const saveSurveyToFB = async (fb:any, pid:string, studyID:string, survey:Record<string, string|number>) => {
    const path = `${studyID}-survey/${pid}`;
    const data = survey;
    saveToFB(fb, path, survey, 'Firebase error adding survey: ');
};


export const getUser = async (fb:any,pid: string) => {
    try {
        const docRef = doc(fb, 'users', pid);
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




