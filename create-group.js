import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import bcrypt from "https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/+esm";
import { showCustomAlert, showSuccessMsg } from "./auth.js";


onAuthStateChanged(auth, (user) => {
    if (!user) {
        showSuccessMsg("⚠️ You must login to access the dashboard.");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 1500);
    } else {
        (async () => {
            const email = user.email.toLowerCase().trim();
            const userQuery = query(collection(db, "users"), where("userEmail", "==", email));
            const snapshot = await getDocs(userQuery);
            if (!snapshot.empty) {
                const userName = snapshot.docs[0].data().username;
                addMemberInput(userName, true);
                console.log(userName)
            }
        })();
    }
});


window.addMemberInput = function (username = "", isCreator = false) {
    const groupSize = parseInt(document.getElementById("groupSize").value);

    // Count non-disabled (removable) members
    const currentMembers = document.querySelectorAll(".memberInput:not([disabled])").length;

    if (!isCreator) {
        if (isNaN(groupSize) || groupSize < 2) {
            showCustomAlert("⚠️ Please enter a valid group size (minimum 2).");
            return;
        }

        if (currentMembers >= groupSize - 1) {
            showCustomAlert("⚠️ You can't add more members than the group size.");
            return;
        }
    }

    const wrapper = document.createElement("div");
    wrapper.className = "memberWrapper";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "memberInput";
    input.required = true;

    if (isCreator) {
        input.value = username + " (admin)";
        input.disabled = true;
    } else {
        input.placeholder = "Allowed Username";
    }

    wrapper.appendChild(input);

    // Add button only if not creator
    if (!isCreator) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.textContent = "❌";
        removeBtn.style.marginLeft = "10px";
        removeBtn.onclick = () => wrapper.remove();
        wrapper.appendChild(removeBtn);
    }

    document.getElementById("membersContainer").appendChild(wrapper);
};

const groupForm = document.getElementById("groupForm");
const membersContainer = document.getElementById("membersContainer");

groupForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const submitBtn = groupForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    const rawgGroupName = document.getElementById("groupName").value.trim();
    const groupName = rawgGroupName.toLowerCase();
    const displayGroupName = rawgGroupName;
    const groupPassword = document.getElementById("groupPassword").value.trim();
    const hashedPassword = bcrypt.hashSync(groupPassword, 10);
    const messageKey = CryptoJS.lib.WordArray.random(16).toString();
    const groupSize = parseInt(document.getElementById("groupSize").value.trim());

    if (!groupName || !groupPassword) {
        showCustomAlert("⚠️ Please fill in all required fields.");
        submitBtn.disabled = false;
        return;
    }
    if (groupPassword.length < 6) {
        showCustomAlert("⚠️ Group password must be at least 6 characters long.");
        submitBtn.disabled = false;
        return;
    }

    const memberInputs = membersContainer.querySelectorAll("input.memberInput");
    const allowedMembers = [];
    let isValid = true;
    showSuccessMsg("⏳ Creating group... Please wait", 40000);

    //  Validate member usernames
    for (let input of memberInputs) {
        const username = input.value.toLowerCase().replace("(admin)", "").trim();
        console.log(username);

        if (!/^[^\s]+$/.test(username)) {
            showCustomAlert("⚠️ Username should not contain spaces")
            isValid = false;
            break;
        }

        if (allowedMembers.includes(username)) {
            showCustomAlert("⚠️ Duplicate usernames are not allowed.");
            isValid = false;
            break;
        }

        allowedMembers.push(username);
    }

    if (!isValid) {
        submitBtn.disabled = false;
        return;
    }

    //  Consolidated validation before proceeding

    if (allowedMembers.length !== groupSize) {
        showCustomAlert(`⚠️ Group size is ${groupSize}, but you added ${allowedMembers.length} members.`);
        submitBtn.disabled = false;
        return;
    }

    //Verify that group name is available or not  
    const groupNameExists = query(collection(db, "groups"), where("name", "==", groupName));
    const querySnapshot = await getDocs(groupNameExists);
    if (!querySnapshot.empty) {
        showCustomAlert("⚠️ Group name already taken. Please choose a different name.");
        submitBtn.disabled = false;
        return; // Stop here if group exists
    }

    // 🔍 Verify that each allowed username exists in Firestore
    try {
        for (let username of allowedMembers) {
            const userQuery = query(collection(db, "users"), where("username", "==", username));
            const snapshot = await getDocs(userQuery);

            if (snapshot.empty) {
                showCustomAlert(`⚠️ Username "${username}" does not exist. Please enter valid usernames.`);
                submitBtn.disabled = false;
                return;
            }
        }

        //  Save group to Firestore
        const groupRef = await addDoc(collection(db, "groups"), {
            name: groupName,
            displayName: displayGroupName,
            password: hashedPassword,
            size: groupSize,
            allowedMembers,
            createdAt: serverTimestamp(),
            admin: auth.currentUser.uid,
            encryptionKey: messageKey
        });

        //  Store doc ID inside the document
        await updateDoc(groupRef, {
            id: groupRef.id
        });
        showSuccessMsg("✅ Group created successfully!");
        setTimeout(() => {
            window.location.href = "join-group.html";
        }, 1500);
    } catch (error) {
        console.log(" Error creating group:", error);
        showCustomAlert("⚠️ Something went wrong. Please try again.");
    } finally {
        submitBtn.disabled = false;
    }
});  