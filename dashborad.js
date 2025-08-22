//dashboard.js

import {auth} from  './firebase-config.js';
import {onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Redirecting unauthorized users

onAuthStateChanged(auth,(user)=>{
if(!user){
    alert("You must log in to access the dashboard.");
    window.location.href = "login.html"
}
});