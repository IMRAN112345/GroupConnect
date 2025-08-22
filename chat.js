import { db, auth } from "./firebase-config.js";
import { showCustomAlert, showSuccessMsg } from "./auth.js";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
  arrayUnion,
  getDocs,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import bcrypt from "https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/+esm";
// Auth check
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showCustomAlert("⚠️ You are not logged in.");
    window.location.href = "login.html";
    return;
  }

  const joinedGroupData = localStorage.getItem("joinedGroup");
  if (!joinedGroupData) {
    showCustomAlert("⚠️ Access denied. Please join a group first.");
    window.location.href = "join-group.html";
    return;
  }

  const { groupName, userName } = JSON.parse(joinedGroupData);

  const chatBox = document.getElementById("chatBox");
  const loader = document.getElementById("loader");
  const chatArea = document.getElementById("chatArea");
  document.getElementById("groupTitle").textContent = `Group: ${groupName}`;

  // --- Fetch group data to check admin ---
  const groupQuery = query(collection(db, "groups"), where("name", "==", groupName));
  const groupSnap = await getDocs(groupQuery);
  if (groupSnap.empty) return showCustomAlert("⚠️ Group not found.");

  const groupData = groupSnap.docs[0].data();
  const groupRef = groupSnap.docs[0].ref;
  const isAdmin = groupData.admin === auth.currentUser.uid;

  // --- Populate Admin Menu ---
  const adminMenuBtn = document.getElementById("adminMenuBtn");
  const adminMenu = document.getElementById("adminMenu");
  adminMenu.innerHTML = "";

  if (isAdmin) {
    const menuItems = [
      { text: "Add Member", action: async () => addMember() },
      { text: "Remove Member", action: async () => removeMember() },
      { text: "Change Password", action: async () => changePassword() },
      { text: "Rename Group", action: async () => renameGroup() },
      { text: "Delete Group", action: async () => deleteGroup() },
      { text: "View Members", action: async () => viewMembers() },
    ];
    menuItems.forEach(item => {
      const btn = document.createElement("button");
      btn.textContent = item.text;
      btn.onclick = item.action;
      adminMenu.appendChild(btn);
    });
  } else {
    const btn = document.createElement("button");
    btn.textContent = "View Members";
    btn.onclick = async () => viewMembers();
    adminMenu.appendChild(btn);
  }

  adminMenuBtn.addEventListener("click", () => {
    adminMenu.style.display = adminMenu.style.display === "block" ? "none" : "block";
  });
  // --- Send Message ---
  const msgInput = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");

  // Function to send message
  async function sendMessage() {
    const message = msgInput.value.trim();
    if (!message) return;
    msgInput.value = "";

    const encryptedMessage = CryptoJS.AES.encrypt(message, groupData.encryptionKey).toString();

    await addDoc(collection(db, "groups", groupName, "messages"), {
      sender: userName,
      message: encryptedMessage,
      timestamp: serverTimestamp()
    });
  }

  // Send button click
  sendBtn.addEventListener("click", sendMessage);

  // Trigger send on Enter key
  msgInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      event.preventDefault(); // prevent new line
      sendMessage();          // call the same send function
    }
  });

  // --- Live Messages ---
  const q = query(
    collection(db, "groups", groupName, "messages"),
    orderBy("timestamp")
  );

  let isFirstSnapshot = true;
  let openMenuMsgDiv = null;
  let lastMessageDate = null; // For grouping messages by date

  onSnapshot(q, (snapshot) => {
    chatBox.innerHTML = "";
    lastMessageDate = null;

    snapshot.forEach(docSnap => {
      const data = docSnap.data();

      // Skip if deleted for this user
      if (data.deletedFor && data.deletedFor.includes(userName)) {
        return;
      }

      // --- DATE GROUP HEADER ---
      if (data.timestamp?.toDate) {
        const msgDate = data.timestamp.toDate().toLocaleDateString("en-GB"); // DD/MM/YYYY
        if (lastMessageDate !== msgDate) {
          const dateHeader = document.createElement("div");
          dateHeader.classList.add("date-header");
          dateHeader.textContent = msgDate.replace(/\//g, "-");
          chatBox.appendChild(dateHeader);
          lastMessageDate = msgDate;
        }
      }

      // Show "Me" if it's your own message
      const displaySender = (data.sender === userName) ? "Me" : data.sender;

      // Format timestamp (time only)
      let timeString = "";
      if (data.timestamp?.toDate) {
        timeString = data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      // Create message container
      const msgDiv = document.createElement("div");
      msgDiv.classList.add("message");

      // Message text
      const textDiv = document.createElement("div");
      const encryptedMessage = data.message;
      const key = groupData.encryptionKey;
      const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
      const originalMessage = bytes.toString(CryptoJS.enc.Utf8);

      textDiv.textContent = `${displaySender}: ${originalMessage}`;
      msgDiv.appendChild(textDiv);

      // Timestamp under message
      const timeDiv = document.createElement("div");
      timeDiv.classList.add("timestamp");
      timeDiv.textContent = timeString;
      msgDiv.appendChild(timeDiv);

      // On click, toggle delete menu
      msgDiv.addEventListener("click", (e) => {
        e.stopPropagation();

        if (openMenuMsgDiv === msgDiv) {
          const existingMenu = msgDiv.querySelector(".delete-menu");
          if (existingMenu) existingMenu.remove();
          openMenuMsgDiv = null;
          return;
        }

        if (openMenuMsgDiv) {
          const oldMenu = openMenuMsgDiv.querySelector(".delete-menu");
          if (oldMenu) oldMenu.remove();
        }

        const menu = document.createElement("div");
        menu.classList.add("delete-menu");

        // Delete for Me
        const delMe = document.createElement("div");
        delMe.textContent = "Delete for Me";
        delMe.classList.add("delete-option");
        delMe.onclick = async () => {
          await updateDoc(docSnap.ref, {
            deletedFor: arrayUnion(userName)
          });
          menu.remove();
          openMenuMsgDiv = null;
        };
        menu.appendChild(delMe);

        // Delete for Everyone
        if (data.sender === userName) {
          const messageTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
          const now = new Date();
          const diffInMinutes = (now - messageTime) / (1000 * 60);

          if (diffInMinutes <= 2) {
            const delAll = document.createElement("div");
            delAll.textContent = "Delete for Everyone";
            delAll.classList.add("delete-option");
            delAll.onclick = async () => {
              await deleteDoc(docSnap.ref);
              menu.remove();
              openMenuMsgDiv = null;
            };
            menu.appendChild(delAll);
          }
        }

        msgDiv.appendChild(menu);
        openMenuMsgDiv = msgDiv;
      });

      chatBox.appendChild(msgDiv);
    });

    // Auto-scroll to bottom
    setTimeout(() => {
      chatBox.scrollTop = chatBox.scrollHeight;
    }, 50);

    if (isFirstSnapshot) {
      loader.style.display = "none";
      chatArea.style.display = "block";
      isFirstSnapshot = false;
    }
  });

  // Close delete menu on outside click
  document.addEventListener("click", () => {
    if (openMenuMsgDiv) {
      const menu = openMenuMsgDiv.querySelector(".delete-menu");
      if (menu) menu.remove();
      openMenuMsgDiv = null;
    }
  });


  // --- Logout ---
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("joinedGroup");
    signOut(auth).then(() => {
      window.location.href = "login.html";
    });
  });


  // --- Admin Functions ---

  // Helper to open side panel

function openSidePanel(title, contentHTML, onSubmit) {
  const sidePanel = document.querySelector(".sidePanel");

  // Close if same panel is already open
  if (sidePanel.classList.contains("open") && sidePanel.querySelector("h3").textContent === title) {
    sidePanel.classList.remove("open");
    return;
  }

  // Open panel with content
  sidePanel.innerHTML = `<h3>${title}</h3>` + contentHTML;
  sidePanel.classList.add("open");

  // Small delay to ensure input/button are in DOM
  setTimeout(() => {
    const submitBtn = sidePanel.querySelector("button[data-submit='true']");
    const firstInput = sidePanel.querySelector("input");

    if (!submitBtn || !firstInput) return;

    // Click handler
    submitBtn.onclick = async () => {
      await onSubmit();
      sidePanel.classList.remove("open");
    };

    // Enter key triggers submit
    firstInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitBtn.click();
      }
    });

    // Auto-focus input
    firstInput.focus();
  }, 50); // 50ms is usually enough for DOM
}




  // Add Member
  async function addMember() {
    openSidePanel(
      "Add Member",
      `<input type="text" id="newMember" placeholder="Username to add" />
     <button data-submit="true">Add Member</button>`,
      async () => {
        showSuccessMsg("⏳ Adding member... Please wait", 30000);
        const username = document.getElementById("newMember").value.trim();
        if (!username) return showCustomAlert("⚠️ Enter a username");
        const allowedMembers = groupData.allowedMembers || [];
        if (allowedMembers.includes(username)) return showCustomAlert("⚠️ User already in group.");

        const userQuery = query(collection(db, "users"), where("username", "==", username));
        const snapshot = await getDocs(userQuery);
        if (snapshot.empty) {
          showCustomAlert(`⚠️ Username "${username}" does not exist. Please enter valid usernames.`);
          return;
        }
        allowedMembers.push(username);
        await updateDoc(groupRef, { allowedMembers });
        showSuccessMsg(`✅ ${username} added to group.`);
      }
    );
  }

  // Remove Member
  // --- Helper function to get UID from username ---
  async function getUIDFromUsername(username) {
    const q = query(collection(db, "users"), where("username", "==", username));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      return querySnap.docs[0].id; // UID of the user

    }
    return null; // if not found
  }

  async function removeMember() {
    openSidePanel(
      "Remove Member",
      `<input type="text" id="removeMember" placeholder="Username to remove" />
     <button data-submit="true">Remove Member</button>`,
      async () => {
        showSuccessMsg("⏳ Removing member... Please wait", 30000);
        const username = document.getElementById("removeMember").value.trim();
        if (!username) return showCustomAlert("⚠️ Enter a username");
        let allowedMembers = groupData.allowedMembers || [];
        const userToRemoveUID = await getUIDFromUsername(username);
        if (2 >= allowedMembers.length) { return showCustomAlert("⚠️ Cannot remove member. A group must have at least 2 members.") }
        console.log(groupData.admin);
        console.log(userToRemoveUID);
        if (userToRemoveUID == groupData.admin) {
          console.log("hello");
          return showCustomAlert("⚠️ Admin cannot be removed from the group.");
        }
        if (!allowedMembers.includes(username)) return showCustomAlert("⚠️ User not in group.");
        allowedMembers = allowedMembers.filter(u => u !== username);
        await updateDoc(groupRef, { allowedMembers });
        showSuccessMsg(`✅ ${username} removed from group.`);
      }
    );
  }

  // Change Password
  async function changePassword() {
    openSidePanel(
      "Change Password",
      `<input type="password" id="newPassword" placeholder="New Password" />
     <button data-submit="true">Change Password</button>`,
      async () => {
        showSuccessMsg("⏳ Changing password... Please wait", 3000);
        const newPass = document.getElementById("newPassword").value.trim();
        if (!newPass || newPass.length < 6) return showCustomAlert("⚠️ Invalid password.");
        const hashed = bcrypt.hashSync(newPass, 10);
        await updateDoc(groupRef, { password: hashed });
        showSuccessMsg("✅ Password changed successfully.");
      }
    );
  }

  // Rename Group
  async function renameGroup() {
    openSidePanel(
      "Rename Group",
      `<input type="text" id="newGroupName" placeholder="New Group Name" />
       <button data-submit="true">Rename</button>`,
      async () => {
        showSuccessMsg("⏳ Processing... Please wait", 40000);
        const newName = document.getElementById("newGroupName").value.trim();
        if (!newName) return showCustomAlert("⚠️ Enter a group name");
        const groupNameExists = query(collection(db, "groups"), where("name", "==", newName));
        const querySnapshot = await getDocs(groupNameExists);
        if (!querySnapshot.empty) {
          showCustomAlert("⚠️ Group name already taken. Please choose a different name.");
          return; // Stop here if group exists
        }
        const oldMessagesSnap = await getDocs(
          collection(db, "groups", groupName, "messages")
        );

        for (const docSnap of oldMessagesSnap.docs) {
          const msgData = docSnap.data();

          await addDoc(collection(db, "groups", newName, "messages"), {
            sender: msgData.sender,
            message: msgData.message,
            timestamp: msgData.timestamp,
          });
        }
        await updateDoc(groupRef, { displayName: newName, name: newName.toLowerCase() });
        document.getElementById("groupTitle").textContent = `Group: ${newName}`;
        showSuccessMsg("✅ Group renamed successfully.");
        // After successful rename
        let joinedGroupData = JSON.parse(localStorage.getItem("joinedGroup"));
        if (joinedGroupData) {
          joinedGroupData.groupName = newName;
          localStorage.setItem("joinedGroup", JSON.stringify(joinedGroupData));
        }
        // 🔹 Background cleanup (delete old messages + doc)
        await Promise.all(
          oldMessagesSnap.docs.map(docSnap =>
            deleteDoc(doc(db, "groups", groupName, "messages", docSnap.id))
          )
        );
        await deleteDoc(doc(db, "groups", groupName)); // delete old group doc
        window.location.reload();
      }
    );
  }

  // Delete Group
  async function deleteGroup() {
    openSidePanel(
      "Delete Group",
      `<p>Are you sure you want to delete this group?</p>
     <button data-submit="true">Delete Group</button>`,
      async () => {
        showSuccessMsg("⏳ Deleting group... Please wait", 30000);
        await deleteDoc(groupRef);
        showSuccessMsg("✅ Group deleted Sucessfully.");
        const oldMessagesSnap = await getDocs(
          collection(db, "groups", groupName, "messages")
        );
        await Promise.all(
          oldMessagesSnap.docs.map(docSnap =>
            deleteDoc(doc(db, "groups", groupName, "messages", docSnap.id))
          )
        );
        await deleteDoc(doc(db, "groups", groupName)); // delete old group doc
        localStorage.removeItem("joinedGroup");
        window.location.href = "dashboard.html";
      }
    );
  }

  // View Members
  async function viewMembers() {
    const members = groupData.allowedMembers || [];

    openSidePanel(
      "Members",
      `<ul id="membersList">
      ${members.map((m, index) => `<li style="${index > 2 ? "display:none;" : ""}">${m}</li>`).join("")}
    </ul>
    ${members.length > 3 ? `<button id="showMoreBtn">+${members.length - 3} more</button>` : ""}`,
      async () => { }
    );

    // Handle "Show More" toggle
    const list = document.getElementById("membersList");
    const toggleBtn = document.getElementById("showMoreBtn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        for (let i = 3; i < list.children.length; i++) {
          list.children[i].style.display = list.children[i].style.display === "none" ? "list-item" : "none";
        }
        toggleBtn.textContent = toggleBtn.textContent === "Show Less"
          ? `+${members.length - 3} more`
          : "Show Less";
      });
    }
  }

});
