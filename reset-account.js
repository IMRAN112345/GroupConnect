// reset-account.js
import { db, auth } from "./firebase-config.js";
import {  showCustomAlert,showSuccessMsg } from "./auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const resetForm = document.getElementById("resetForm");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");

resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim().toLowerCase();
    const email = emailInput.value.trim().toLowerCase();

    if (!username || !email) {
        showCustomAlert("⚠️ Please fill both fields.");
        return;
    }
    showSuccessMsg("⏳ Processing... Please wait",1000);
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef,
            where("username", "==", username),
            where("userEmail", "==", email)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            showCustomAlert("⚠️ Username and email do not match.");
            return;
        }

        // Send password reset email
        await sendPasswordResetEmail(auth, email);
        showSuccessMsg(`✅ Password reset email sent to ${email}.`);

        resetForm.reset();
    } catch (err) {
        console.log(err);
        showCustomAlert("⚠️ Something went wrong. Try again later.");
    }
});
