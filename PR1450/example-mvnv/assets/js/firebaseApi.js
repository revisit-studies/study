// Mini api to connect to, add and retrieve data from a FireBase datastore.


let db;

let fireStore = {

    connect() {
        // Your web app's Firebase configuration
        var firebaseConfig = {
          apiKey: 'AIzaSyAdGhNvUkAKeMWhzPHfuoXPUC36gBj68wU',
          authDomain: 'mvn-turk.firebaseapp.com',
          databaseURL: 'https://mvn-turk.firebaseio.com',
          projectId: 'mvn-turk',
          storageBucket: '',
          messagingSenderId: '83565157892',
          appId: '1:83565157892:web:9fff8e165c4e2651'
        };
        // Initialize Firebase
        let app = firebase.initializeApp(firebaseConfig, 'writeApp');

        db = firebase.firestore(app);
      },

      updateTask(data){
        db.collection('results').doc(workerID).set(data,{ merge: true }); //shouldn't need the merge value;
      },

      addDocument(data,collection) {
        db.collection(collection).doc(workerID)
          .set(data)
          .catch(function(error) {
            console.error('Error adding document: ', error);
          });
      },

      async getCollection(name = 'tasks') {
        db.collection(name)
          .get()
          .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
              console.log(`${doc.id} => ${doc.data()}`);
            });

            return querySnapshot;
          });
      }

};
