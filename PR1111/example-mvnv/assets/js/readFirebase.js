// Mini api to connect to, add and retrieve data from a FireBase datastore.


let readDb;

window.addEventListener('hashchange', function (event) {
// Log the state data to the console
  provenance.goToNode(window.location.hash.substr(1));
});

let readFire = {



    connect() {
      console.log('connecting');
        // Your web app's Firebase configuration
        const firebaseConfig = {
          apiKey: 'AIzaSyDTzSonRW7uojuqvbWzn7vxGNExXl61hm4',
          authDomain: 'mvnv-study.firebaseapp.com',
          databaseURL: 'https://mvnv-study.firebaseio.com',
          projectId: 'mvnv-study',
          storageBucket: 'mvnv-study.appspot.com',
          messagingSenderId: '217128159504',
          appId: '1:217128159504:web:73df3ecf61ac72f0e9fd95'
        };
        // Initialize Firebase
        let a = firebase.initializeApp(firebaseConfig, 'readUniqueApp');

        readDb = firebase.firestore(a);
      },

      // updateTask(data){
      //   db.collection('results').doc(workerID).set(data,{ merge: true }); //shouldn't need the merge value;
      // },
      //

      readTask(participantId, taskID) {

        return readDb.collection('studyData')
          .doc(participantId + '-' + taskID)
          .get()
          .then(function(dataSnapshot) {
            let dataJson = dataSnapshot.data();
            console.log(dataJson);
            return dataJson;
          });
      }
      //
      // async getCollection(name = "tasks") {
      //   db.collection(name)
      //     .get()
      //     .then(querySnapshot => {
      //       querySnapshot.forEach(doc => {
      //         console.log(`${doc.id} => ${doc.data()}`);
      //       });
      //
      //       return querySnapshot
      //     });
      // }

};
