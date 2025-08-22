import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import bcrypt from "https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/+esm";
import {showCustomAlert,showSuccessMsg} from "./auth.js";

const joinForm = document.getElementById("joinGroupForm");


// Ensure user is logged in
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        showCustomAlert("⚠️ You must be logged in to join a group.");
        window.location.href = "/login.html";
        return;
    }

    const userId = user.uid;

    //  Get username from Firestore "users" collection
    let username = "";
    try {
        const userQuery = query(
            collection(db, "users"),
            where("uid", "==", userId)
        );
        const userSnap = await getDocs(userQuery);

        if (userSnap.empty) {
            showCustomAlert("⚠️ Your account is not registered properly.");
            window.location.href = "register.html";
            return;
        }

        username = userSnap.docs[0].data().username;

    } catch (err) {
        console.error("Error fetching user info:", err);
        showCustomAlert("⚠️ Something went wrong. Try again later.");
        return;
    }

    //  Handle form submission
    joinForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const groupName = document.getElementById("groupName").value.trim().toLowerCase();
        const groupPassword = document.getElementById("password").value.trim();
       
        if (groupPassword.length < 6) {
            showCustomAlert("⚠️ Password must be at least 6 characters.");
            return;
        }

        try {
            const groupQuery = query(
                collection(db, "groups"),
                where("name", "==", groupName),
            );

            const groupSnap = await getDocs(groupQuery);

            if (groupSnap.empty) {
                showCustomAlert("⚠️ Group not found or incorrect password.");
                return;
            }
           const groupData = groupSnap.docs[0].data();
           const isMatch = bcrypt.compareSync(groupPassword, groupData.password);
            if(!isMatch){
                 showCustomAlert("⚠️ Group not found or incorrect password.");
                 console.log("not working")
                 console.log(groupData.password);
                return;
            }
            // Validate allowed members
            const allowedMembers = groupData.allowedMembers || [];

            if (!allowedMembers.includes(username)) {
                showCustomAlert("⚠️ You are not allowed to join this group.");
                return;
            }
            showSuccessMsg("✅ Successfully joined the group!");

            localStorage.setItem("joinedGroup", JSON.stringify({
                groupName: groupName,
                userName: username
            }));
            setTimeout(() => {
                window.location.href = "chat.html";
            }, 1500);

        } catch (error) {
            console.error("Error joining group:", error);
            showCustomAlert("⚠️ Something went wrong. Try again later.");
        }
    });
});
