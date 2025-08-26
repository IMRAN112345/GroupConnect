import { auth, db } from "./firebase-config.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    updateProfile,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection,
    setDoc,
    doc,
    query,
    where,
    limit,
    getDocs,
    getDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Initialize EmailJS
emailjs.init('N6hJw0nZntlgC14WK'); // Your public key

// ----- Custom alert functions -----
let alertTimeout = null;
function showCustomAlert(message) {
    const alertBox = document.getElementById("customAlert");
    const alertMessage = document.getElementById("alertMessage");
    const validationBtn = document.getElementById("validation");
    if (alertTimeout) clearTimeout(alertTimeout);
    alertMessage.textContent = message;
    if (validationBtn) validationBtn.style.display = "inline-block";
    alertBox.classList.add("show");
}

function showSuccessMsg(message, duration = 1500) {
    const alertBox = document.getElementById("customAlert");
    const alertMessage = document.getElementById("alertMessage");
    const validationBtn = document.getElementById("validation");
    if (validationBtn) validationBtn.style.display = "none";
    alertMessage.textContent = message;
    alertBox.classList.add("show");
    alertTimeout = setTimeout(() => {
        alertBox.classList.remove("show");
        alertTimeout = null;
    }, duration);
}

window.hideCustomAlert = function () {
    const alertBox = document.getElementById("customAlert");
    alertBox.classList.remove("show");
}

// ----- EmailJS function -----
async function sendEmailJSEmail(name, email) {
    try {
        const templateParams = {
            name: name,
            email: email
        };

        await emailjs.send(
            'service_sedbi6f',      // Service ID
            'template_tdpzxzb',     // Template ID
            templateParams
        );

        console.log('EmailJS verification email sent!');
    } catch (err) {
        console.error('EmailJS sending error:', err);
        showCustomAlert("Something went wrong. Please try again.")
    }
}

// ----- REGISTER -----
const registerForm = document.getElementById("registerForm");
if (registerForm) {
    registerForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const userNameReg = document.getElementById("userNameRegister").value;
        const userName = userNameReg.trim().toLowerCase();
        if (!/^[^\s]+$/.test(userName)) {
            showCustomAlert("⚠️ Username should not contain spaces");
            return;
        }

        const email = document.getElementById("emailRegister").value.trim().toLowerCase();
        const passwordReg = document.getElementById("passwordRegister").value;
        const confirmPasswordReg = document.getElementById("confirmPassword").value;
        if (passwordReg !== confirmPasswordReg) {
            showCustomAlert("⚠️ Passwords do not match.");
            return;
        }

        showSuccessMsg("⏳ Creating your account...", 6000);

        try {
            const userQuery = query(collection(db, "users"), where("username", "==", userName));
            const snapshot = await getDocs(userQuery);
            if (!snapshot.empty) {
                showCustomAlert("⚠️ Username already taken. Please choose another one.");
                return;
            }

            // Create user
            const userCredential = await createUserWithEmailAndPassword(auth, email, passwordReg);
            const user = userCredential.user;

            await updateProfile(auth.currentUser, {
                displayName: userName // or take from your signup form
            });
            // Save user to Firestore
            await setDoc(doc(db, "users", user.uid), {
                username: userName,
                userEmail: email,
                uid: user.uid,
                createdAt: serverTimestamp(),
            });

            // ----- Generate Firebase verification link -----
            const actionCodeSettings = {
                url: 'https://group-connect.vercel.app/login.html', // redirect after verification
                handleCodeInApp: false
            };
            await sendEmailVerification(user, actionCodeSettings);


            sendEmailJSEmail(userName, email);

            showSuccessMsg("📧 Verification email sent! Please check your inbox.", 3000);

            // Auto sign out after registration
            setTimeout(() => {
                signOut(auth);
                window.location.href = "login.html"
            }, 2000);

        } catch (e) {
            const error = e.code;
            console.log(error);
            if (error === 'auth/email-already-in-use') {
                showCustomAlert("⚠️ That email is already in use.");
            } else if (error === 'auth/weak-password') {
                showCustomAlert("⚠️ Password should be at least 6 characters.");
            } else if (error === 'auth/invalid-email') {
                showCustomAlert("⚠️ Please enter a valid email address");
            } else {
                showCustomAlert("⚠️ Something went wrong. Please try again.");
            }
        }
    });
}

// ----- LOGIN -----
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        showSuccessMsg("⏳ Logging you in...",5000);
        const rawLoginData = document.getElementById("userLogin").value.trim().toLowerCase();
        const password = document.getElementById("passwordLogin").value;
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        let rawEmail = "";
        let isEmail;

        if (emailPattern.test(rawLoginData)) {
            rawEmail = rawLoginData;
            isEmail = true;
        } else {
            const userQuery = query(collection(db, "users"), where("username", "==", rawLoginData), limit(1));
            const snapshot = await getDocs(userQuery);
            if (!snapshot.empty) {
                rawEmail = snapshot.docs[0].data().userEmail;
            } else {
                showCustomAlert("⚠️ Username not found.");
                return;
            }
        }

        const email = rawEmail;


        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const createdAt = userData.createdAt?.toMillis ? userData.createdAt.toMillis() : Date.now();
                const now = Date.now();
                const hoursPassed = (now - createdAt) / (1000 * 60 * 60);

                // If email not verified and expired (24h)
                if (!user.emailVerified && hoursPassed > 24) {
                    try {
                        await deleteDoc(userRef);   // delete from Firestore
                        await deleteUser(user);     // delete from Auth
                        showSuccessMsg("⚠️ Your account expired because email was not verified. Create account again!",4000);
                        setTimeout(() => {
                            window.location.href = "register.html"; // Redirect to register page
                        }, 3500);

                    } catch (error) {
                        console.error("Error deleting user from Auth:", error);
                    }
                    return;
                }
            }

            if (!user.emailVerified) {
                showCustomAlert("⚠️ Please verify your email before logging in.");
                await signOut(auth);   // ✅ cleaner
                return;
            }


            showSuccessMsg("✅ Login Successful");
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1000);

        } catch (error) {
            console.log("Actual Error Code →", error.code);
            if (error.code === "auth/invalid-credential" || error.code === "auth/invalid-email") {
                showCustomAlert(isEmail ? "⚠️ Email or password is incorrect." : "⚠️ Username or password is incorrect.");
            } else if (error.code === "auth/network-request-failed") {
                showCustomAlert("⚠️ Network error. Please check your internet connection.");
            } else {
                showCustomAlert("⚠️ Something went wrong. Please try again.");
            }
        }
    });
}

export { showCustomAlert, showSuccessMsg };






