/* =========================================================
   QUICKPAY
   Firebase + QR Prototype
========================================================= */


/* =========================================================
   FIREBASE
========================================================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyC9qC5SRO5hrHMRywxAiQQ--uYdIXL57fw",

    authDomain:
        "quickpay-63af0.firebaseapp.com",

    databaseURL:
        "https://quickpay-63af0-default-rtdb.firebaseio.com",

    projectId:
        "quickpay-63af0",

    storageBucket:
        "quickpay-63af0.firebasestorage.app",

    messagingSenderId:
        "972376102284",

    appId:
        "1:972376102284:web:8113f173fb85457ed332a9"
};


firebase.initializeApp(firebaseConfig);

const database =
    firebase.database();



/* =========================================================
   LOCAL STORAGE
========================================================= */

let accounts =
    JSON.parse(
        localStorage.getItem("quickpay_accounts") || "[]"
    );

let localTransactions =
    JSON.parse(
        localStorage.getItem("quickpay_transactions") || "[]"
    );


function saveAccounts() {

    localStorage.setItem(
        "quickpay_accounts",
        JSON.stringify(accounts)
    );
}


function saveLocalTransactions() {

    localStorage.setItem(
        "quickpay_transactions",
        JSON.stringify(localTransactions)
    );
}



/* =========================================================
   CURRENT STATE
========================================================= */

let currentReceiveTransactionId = null;

let currentReceiveRef = null;

let receiveListener = null;

let scanner = null;

let scannerRunning = false;

let scannedPayment = null;

let selectedAccountForDelete = null;

let transactionFilter = "all";

let pendingSessionToken = null;



/* =========================================================
   NOTIFICATION SYSTEM
========================================================= */

function showToast(message, type) {

    type = type || "info";


    /* Remove existing toasts. */

    const oldToasts =
        document.querySelectorAll(".toast");


    oldToasts.forEach(toast => {

        toast.remove();

    });


    const toast =
        document.createElement("div");


    toast.className =
        "toast toast-" + type;


    toast.textContent =
        message;


    document.body.appendChild(toast);


    /* Auto-dismiss after 3 seconds. */

    setTimeout(() => {

        toast.style.opacity = "0";

        toast.style.transition = "opacity .3s";


        setTimeout(() => {

            toast.remove();

        }, 300);

    }, 3000);
}



/* =========================================================
   PAGE NAVIGATION
========================================================= */

function showPage(pageId) {

    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove("active");

        });

    const page =
        document.getElementById(pageId);

    if (page) {

        page.classList.add("active");

    }

    window.scrollTo(0, 0);
}


function goHome() {

    stopScanner();

    stopReceiveListener();

    showPage("homePage");
}


function openSendPage() {

    populateSendAccounts();

    document.getElementById("sendPin").value = "";

    document.getElementById("manualTransactionId").value = "";

    showPage("sendPage");
}


function openReceivePage() {

    populateReceiveAccounts();

    document
        .getElementById("receiveForm")
        .classList.remove("hidden");

    document
        .getElementById("qrArea")
        .classList.add("hidden");

    document
        .getElementById("receiveSuccess")
        .classList.add("hidden");

    showPage("receivePage");
}


function openAccountsPage() {

    renderAccounts();

    showPage("accountsPage");
}


function openTransactionsPage() {

    renderTransactions();

    showPage("transactionsPage");
}



/* =========================================================
   TOGGLE NATIONAL ID
========================================================= */

function toggleNationalId() {

    const provider =
        document.getElementById("accountProvider").value;

    const nationalIdGroup =
        document.getElementById("nationalIdGroup");

    const bankProviders = ["fdh", "nbs", "national"];

    if (bankProviders.includes(provider)) {

        nationalIdGroup.classList.add("visible");

    } else {

        nationalIdGroup.classList.remove("visible");

    }

}



/* =========================================================
   VERIFY ACCOUNT FROM FIREBASE
========================================================= */

async function verifyAccount(provider, accountNumber, password, nationalId = null) {

    try {

        // Get all accounts for this provider
        const snapshot = await database
            .ref(`mock_bank_data/${provider}`)
            .once("value");

        const accounts = snapshot.val();

        if (!accounts) {
            return { success: false, message: "Provider not found" };
        }

        // Convert object to array and find matching account
        const accountList = Object.values(accounts);
        const account = accountList.find(a => a.accountNumber === accountNumber);

        if (!account) {
            return { success: false, message: "Account not found" };
        }

        if (account.password !== password) {
            return { success: false, message: "Invalid password" };
        }

        // Bank accounts require national ID
        if (account.type === "bank") {
            if (!nationalId || account.nationalId !== nationalId) {
                return { success: false, message: "Invalid National ID" };
            }
        }

        // Password matches! Generate session token
        const token = generateToken(accountNumber, provider);

        return {
            success: true,
            account: {
                number: account.accountNumber,
                name: account.name,
                provider: provider,
                balance: account.balance,
                type: account.type
            },
            token: token
        };

    } catch (error) {
        console.error("Verification error:", error);
        return { success: false, message: "Verification failed" };
    }
}



/* =========================================================
   GENERATE SESSION TOKEN
========================================================= */

function generateToken(accountNumber, provider) {

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const token = btoa(`${accountNumber}:${provider}:${timestamp}:${random}`);
    return token;
}


function decodeToken(token) {

    try {
        const decoded = atob(token);
        const parts = decoded.split(":");
        return {
            accountNumber: parts[0],
            provider: parts[1],
            timestamp: parts[2],
            random: parts[3]
        };
    } catch (e) {
        return null;
    }
}



/* =========================================================
   UPDATE ACCOUNT BALANCE
========================================================= */

async function updateBalance(accountNumber, provider, newBalance) {

    try {
        const snapshot = await database
            .ref(`mock_bank_data/${provider}`)
            .once("value");

        const accounts = snapshot.val();
        if (!accounts) return { success: false, message: "Provider not found" };

        const accountKey = Object.keys(accounts).find(
            key => accounts[key].accountNumber === accountNumber
        );

        if (!accountKey) {
            return { success: false, message: "Account not found" };
        }

        await database
            .ref(`mock_bank_data/${provider}/${accountKey}/balance`)
            .set(newBalance);

        return { success: true };

    } catch (error) {
        console.error("Balance update error:", error);
        return { success: false, message: "Balance update failed" };
    }
}



/* =========================================================
   SEND MONEY FUNCTION
========================================================= */

async function sendMoney(sessionToken, receiverNumber, amount, fee = 20) {

    try {
        const decoded = decodeToken(sessionToken);
        if (!decoded) {
            return { success: false, message: "Invalid session" };
        }

        const { accountNumber, provider } = decoded;

        // Get sender details
        const senderSnapshot = await database
            .ref(`mock_bank_data/${provider}`)
            .once("value");

        const senderAccounts = senderSnapshot.val();
        if (!senderAccounts) {
            return { success: false, message: "Sender provider not found" };
        }

        const senderKey = Object.keys(senderAccounts).find(
            key => senderAccounts[key].accountNumber === accountNumber
        );

        if (!senderKey) {
            return { success: false, message: "Sender account not found" };
        }

        const sender = senderAccounts[senderKey];
        const totalAmount = amount + fee;

        if (sender.balance < totalAmount) {
            return { success: false, message: "Insufficient balance" };
        }

        // Find receiver (check all providers)
        const providers = ["tnm", "airtel", "fdh", "nbs", "national"];
        let receiverAccount = null;
        let receiverProvider = null;
        let receiverKey = null;

        for (const prov of providers) {
            const snapshot = await database
                .ref(`mock_bank_data/${prov}`)
                .once("value");

            const accounts = snapshot.val();
            if (!accounts) continue;

            const key = Object.keys(accounts).find(
                k => accounts[k].accountNumber === receiverNumber
            );

            if (key) {
                receiverAccount = accounts[key];
                receiverProvider = prov;
                receiverKey = key;
                break;
            }
        }

        if (!receiverAccount) {
            return { success: false, message: "Receiver account not found" };
        }

        // Update balances
        const senderNewBalance = sender.balance - totalAmount;
        const receiverNewBalance = receiverAccount.balance + amount;

        // Update sender
        await database
            .ref(`mock_bank_data/${provider}/${senderKey}/balance`)
            .set(senderNewBalance);

        // Update receiver
        await database
            .ref(`mock_bank_data/${receiverProvider}/${receiverKey}/balance`)
            .set(receiverNewBalance);

        // Create transaction record
        const transactionId = "TXN_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

        const transaction = {
            id: transactionId,
            type: "sent",
            from: accountNumber,
            fromProvider: provider,
            fromName: sender.name,
            to: receiverNumber,
            toProvider: receiverProvider,
            toName: receiverAccount.name,
            amount: amount,
            fee: fee,
            total: totalAmount,
            status: "completed",
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            timestamp: Date.now()
        };

        await database
            .ref(`quickpay_transactions/${transactionId}`)
            .set(transaction);

        return {
            success: true,
            transaction: transaction,
            newBalance: senderNewBalance
        };

    } catch (error) {
        console.error("Send money error:", error);
        return { success: false, message: "Transaction failed" };
    }
}



/* =========================================================
   ACCOUNTS - ADD ACCOUNT
========================================================= */

async function addAccount() {

    const provider =
        document.getElementById("accountProvider").value;

    const number =
        document.getElementById("accountNumber").value.trim();

    const name =
        document.getElementById("accountName").value.trim();

    const pin =
        document.getElementById("accountPin").value.trim();

    const nationalId =
        document.getElementById("nationalId").value.trim() || null;


    if (!provider) {
        showToast("Please select a provider.", "error");
        return;
    }

    if (!number) {
        showToast("Please enter the account or mobile number.", "error");
        return;
    }

    if (!name) {
        showToast("Please enter the account name.", "error");
        return;
    }

    if (!pin) {
        showToast("Please enter your PIN/password.", "error");
        return;
    }

    // Verify with Firebase mock database
    const result = await verifyAccount(provider, number, pin, nationalId);

    if (!result.success) {
        showToast(result.message, "error");
        return;
    }

    // Account verified! Save only account details (NOT password)
    const account = {
        id: "acc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
        provider: provider,
        number: result.account.number,
        name: result.account.name,
        type: result.account.type || "mobile",
        balance: result.account.balance,
        createdAt: new Date().toISOString()
        // ❌ NO PASSWORD SAVED
    };

    // Check if account already exists
    const existing = accounts.find(a => a.number === account.number && a.provider === account.provider);
    if (existing) {
        showToast("This account is already added.", "info");
        return;
    }

    accounts.push(account);
    saveAccounts();

    // Clear form
    document.getElementById("accountNumber").value = "";
    document.getElementById("accountName").value = "";
    document.getElementById("accountPin").value = "";
    document.getElementById("nationalId").value = "";
    document.getElementById("nationalIdGroup").classList.remove("visible");

    renderAccounts();

    showToast(`✅ Account ${result.account.name} verified and added successfully!`, "success");
}



/* =========================================================
   RENDER ACCOUNTS
========================================================= */

function renderAccounts() {

    const container =
        document.getElementById("accountsList");

    if (!container) return;


    container.innerHTML = "";


    if (accounts.length === 0) {

        container.innerHTML = `

            <div class="empty-transactions">

                <strong>No accounts yet</strong>

                <p>
                    Add a TNM, Airtel, bank or other account below.
                </p>

            </div>

        `;

        return;
    }


    accounts.forEach(account => {

        const card =
            document.createElement("div");

        card.className =
            "account-card";


        const providerDisplay = account.provider.charAt(0).toUpperCase() + account.provider.slice(1);

        card.innerHTML = `

            <div class="account-provider">
                ${escapeHtml(providerDisplay)}
            </div>

            <div class="account-name">
                ${escapeHtml(account.name)}
            </div>

            <div class="account-number">
                ${escapeHtml(account.number)}
            </div>

            <div class="account-hint">
                Balance: MWK ${formatMoney(account.balance || 0)} • Long press to delete
            </div>

        `;


        /*
         * Long press support
         */

        let pressTimer = null;


        card.addEventListener(
            "touchstart",
            function () {

                pressTimer =
                    setTimeout(
                        () => {

                            openDeleteModal(account);

                        },
                        700
                    );

            },
            {
                passive: true
            }
        );


        card.addEventListener(
            "touchend",
            function () {

                clearTimeout(pressTimer);

            }
        );


        card.addEventListener(
            "touchmove",
            function () {

                clearTimeout(pressTimer);

            }
        );


        /*
         * Desktop mouse support
         */

        card.addEventListener(
            "mousedown",
            function () {

                pressTimer =
                    setTimeout(
                        () => {

                            openDeleteModal(account);

                        },
                        700
                    );

            }
        );


        card.addEventListener(
            "mouseup",
            function () {

                clearTimeout(pressTimer);

            }
        );


        card.addEventListener(
            "mouseleave",
            function () {

                clearTimeout(pressTimer);

            }
        );


        container.appendChild(card);

    });
}



/* =========================================================
   DELETE ACCOUNT
========================================================= */

function openDeleteModal(account) {

    selectedAccountForDelete =
        account;


    document
        .getElementById("deleteAccountName")
        .textContent =
            account.provider.charAt(0).toUpperCase() + account.provider.slice(1) +
            " - " +
            account.name;


    document
        .getElementById("deleteAccountNumber")
        .textContent =
            account.number;


    document
        .getElementById("deleteModal")
        .classList.remove("hidden");
}


function closeDeleteModal() {

    selectedAccountForDelete =
        null;

    document
        .getElementById("deleteModal")
        .classList.add("hidden");
}


function confirmDeleteAccount() {

    if (!selectedAccountForDelete) {

        return;
    }


    const id =
        selectedAccountForDelete.id;


    accounts =
        accounts.filter(
            account =>
                account.id !== id
        );


    saveAccounts();

    closeDeleteModal();

    renderAccounts();

    showToast("Account deleted.", "info");
}



/* =========================================================
   POPULATE ACCOUNT SELECTORS
========================================================= */

function populateSendAccounts() {

    const select =
        document.getElementById("sendAccount");

    if (!select) return;


    select.innerHTML = `

        <option value="">
            Select account
        </option>

    `;


    accounts.forEach(account => {

        const option =
            document.createElement("option");

        option.value =
            account.id;

        const providerDisplay = account.provider.charAt(0).toUpperCase() + account.provider.slice(1);

        option.textContent =
            providerDisplay +
            " - " +
            account.name +
            " (" +
            account.number +
            ")";


        select.appendChild(option);

    });
}


function populateReceiveAccounts() {

    const select =
        document.getElementById("receiveAccount");

    if (!select) return;


    select.innerHTML = `

        <option value="">
            Select account
        </option>

    `;


    accounts.forEach(account => {

        const option =
            document.createElement("option");

        option.value =
            account.id;

        const providerDisplay = account.provider.charAt(0).toUpperCase() + account.provider.slice(1);

        option.textContent =
            providerDisplay +
            " - " +
            account.name +
            " (" +
            account.number +
            ")";


        select.appendChild(option);

    });
}



/* =========================================================
   RECEIVE — CREATE PAYMENT
========================================================= */

async function createReceivePayment() {

    const accountId =
        document
            .getElementById("receiveAccount")
            .value;


    const amount =
        Number(
            document
                .getElementById("receiveAmount")
                .value
        );


    if (!accountId) {

        showToast("Please select the account that will receive the money.", "error");

        return;
    }


    if (!amount || amount <= 0) {

        showToast("Please enter a valid amount.", "error");

        return;
    }


    const account =
        accounts.find(
            item =>
                item.id === accountId
        );


    if (!account) {

        showToast("Account could not be found.", "error");

        return;
    }


    /*
     * Generate unique transaction ID.
     */

    const transactionId =
        "QP_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 10);


    const now =
        new Date();


    const transaction = {

        id: transactionId,

        type: "receive",

        status: "active",

        amount: amount,

        fee: 20,

        total: amount + 20,

        receiver: {

            provider:
                account.provider,

            accountNumber:
                account.number,

            accountName:
                account.name,

            accountId:
                account.id

        },

        createdDate:
            now.toLocaleDateString(),

        createdTime:
            now.toLocaleTimeString(),

        createdAt:
            now.toISOString()

    };


    try {

        await database
            .ref(
                "quickpay_transactions/" +
                transactionId
            )
            .set(transaction);


        currentReceiveTransactionId =
            transactionId;


        currentReceiveRef =
            database.ref(
                "quickpay_transactions/" +
                transactionId
            );


        /*
         * Generate QR.
         */

        const qrData =
            JSON.stringify({

                quickpay: true,

                version: 1,

                transactionId:
                    transactionId

            });


        const qrContainer =
            document.getElementById("qrcode");


        qrContainer.innerHTML = "";


        new QRCode(
            qrContainer,
            {

                text: qrData,

                width: 300,

                height: 300,

                correctLevel:
                    QRCode.CorrectLevel.H

            }
        );


        // Display transaction ID
        document.getElementById("displayTransactionId").textContent = transactionId;


        document
            .getElementById("receiveForm")
            .classList.add("hidden");


        document
            .getElementById("qrArea")
            .classList.remove("hidden");


        document
            .getElementById("receiveSuccess")
            .classList.add("hidden");


        startReceiveListener();


    } catch (error) {

        console.error(error);

        showToast("Could not create payment: " + error.message, "error");

    }

}



/* =========================================================
   RECEIVE — WATCH TRANSACTION
========================================================= */

function startReceiveListener() {

    stopReceiveListener();


    if (!currentReceiveTransactionId) {

        return;
    }


    currentReceiveRef =
        database.ref(
            "quickpay_transactions/" +
            currentReceiveTransactionId
        );


    receiveListener =
        currentReceiveRef.on(
            "value",
            snapshot => {

                const data =
                    snapshot.val();


                if (!data) return;


                if (data.status === "done") {

                    showReceivedPayment(data);

                }


                if (data.status === "cancelled") {

                    document
                        .getElementById("waitingText")
                        .textContent =
                            "This payment has been cancelled.";

                }

            }
        );
}


function stopReceiveListener() {

    if (
        currentReceiveRef &&
        receiveListener
    ) {

        currentReceiveRef.off(
            "value",
            receiveListener
        );

    }


    currentReceiveRef =
        null;

    receiveListener =
        null;
}



/* =========================================================
   RECEIVE — SHOW SUCCESS
========================================================= */

function showReceivedPayment(data) {

    stopReceiveListener();


    /* Add to local transactions. */

    const receivedRecord = {

        id:
            "local_" +
            Date.now(),

        type:
            "received",

        status:
            "done",

        amount:
            Number(data.amount),

        fee:
            Number(data.fee || 0),

        total:
            Number(data.amount) +
            Number(data.fee || 0),

        provider:
            data.receiver.provider,

        name:
            data.receiver.accountName,

        accountNumber:
            data.receiver.accountNumber,

        date:
            data.completedDate || data.createdDate,

        time:
            data.completedTime || data.createdTime,

        transactionId:
            data.id

    };


    localTransactions.unshift(receivedRecord);

    saveLocalTransactions();


    const amount =
        Number(data.amount || 0);


    document
        .getElementById("receivedAmountText")
        .textContent =
            "MWK " +
            formatMoney(amount);


    document
        .getElementById("receivedFromText")
        .textContent =
            "You have received money successfully.";


    document
        .getElementById("receivedAccountText")
        .textContent =
            data.receiver?.provider +
            " - " +
            data.receiver?.accountNumber;


    document
        .getElementById("receivedDateText")
        .textContent =
            data.completedDate ||
            data.createdDate ||
            "-";


    document
        .getElementById("receivedTimeText")
        .textContent =
            data.completedTime ||
            data.createdTime ||
            "-";


    document
        .getElementById("qrArea")
        .classList.add("hidden");


    document
        .getElementById("receiveSuccess")
        .classList.remove("hidden");


    showToast("Payment received successfully!", "success");
}



/* =========================================================
   RECEIVE — DONE
========================================================= */

function finishReceive() {

    stopReceiveListener();

    currentReceiveTransactionId =
        null;

    goHome();
}



/* =========================================================
   RECEIVE — CANCEL
========================================================= */

async function cancelReceivePayment() {

    if (!currentReceiveTransactionId) {

        goHome();

        return;
    }


    const confirmed =
        confirm(
            "Cancel this payment request?"
        );


    if (!confirmed) {

        return;
    }


    try {

        const ref =
            database.ref(
                "quickpay_transactions/" +
                currentReceiveTransactionId
            );


        const result =
            await ref.transaction(
                current => {

                    if (!current) {

                        return current;
                    }


                    if (
                        current.status !==
                        "active"
                    ) {

                        return;

                    }


                    current.status =
                        "cancelled";


                    current.cancelledAt =
                        new Date().toISOString();


                    return current;

                }
            );


        stopReceiveListener();


        currentReceiveTransactionId =
            null;


        goHome();


        showToast("Payment cancelled.", "info");


    } catch (error) {

        console.error(error);

        showToast("Could not cancel payment.", "error");

    }

}



/* =========================================================
   QR SAVE
========================================================= */

function getQRCodeImage() {

    const qr =
        document.getElementById("qrcode");


    if (!qr) return null;


    const canvas =
        qr.querySelector("canvas");


    if (canvas) {

        return canvas.toDataURL(
            "image/png"
        );

    }


    const img =
        qr.querySelector("img");


    if (img) {

        return img.src;

    }


    return null;
}


function saveQRCode() {

    const image =
        getQRCodeImage();


    if (!image) {

        showToast("QR code is not ready.", "error");

        return;
    }


    const link =
        document.createElement("a");


    link.href =
        image;


    link.download =
        "QuickPay-QR-" +
        (currentReceiveTransactionId || "payment") +
        ".png";


    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    showToast("QR code saved.", "success");
}



/* =========================================================
   QR SHARE
========================================================= */

async function shareQRCode() {

    const image =
        getQRCodeImage();


    if (!image) {

        showToast("QR code is not ready.", "error");

        return;
    }


    try {

        const response =
            await fetch(image);


        const blob =
            await response.blob();


        const file =
            new File(
                [
                    blob
                ],
                "QuickPay-QR.png",
                {
                    type: "image/png"
                }
            );


        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [file]
            })
        ) {

            await navigator.share({

                title:
                    "QuickPay Payment",

                text:
                    "Scan this QuickPay QR code.",

                files:
                    [file]

            });


            return;
        }


        if (navigator.share) {

            await navigator.share({

                title:
                    "QuickPay Payment",

                text:
                    "Scan this QuickPay QR code."

            });

            return;
        }


        showToast("Your browser does not support image sharing. Use Save QR instead.", "info");


    } catch (error) {

        console.error(error);

        if (
            error.name !==
            "AbortError"
        ) {

            showToast("Sharing was not available on this device.", "info");

        }

    }

}



/* =========================================================
   SEND — START SCANNER
========================================================= */

async function startScanner() {

    const accountId =
        document
            .getElementById("sendAccount")
            .value;


    const pin =
        document
            .getElementById("sendPin")
            .value;


    if (!accountId) {

        showToast("Please select the account you want to send from.", "error");

        return;
    }


    if (!pin) {

        showToast("Please enter your account PIN/password.", "error");

        return;
    }


    const account =
        accounts.find(
            item =>
                item.id === accountId
        );


    if (!account) {

        showToast("Selected account not found.", "error");

        return;
    }


    // Verify password against Firebase
    const result = await verifyAccount(
        account.provider,
        account.number,
        pin,
        null
    );

    if (!result.success) {
        showToast("❌ " + result.message, "error");
        return;
    }

    // Password verified! Store session token
    pendingSessionToken = result.token;
    window.pendingSendAccount = account;

    showToast("✅ Password verified. Scan QR code or enter Transaction ID.", "success");


    document
        .getElementById("scannerArea")
        .classList.remove("hidden");


    try {

        scanner =
            new Html5Qrcode("reader");


        scannerRunning =
            true;


        await scanner.start(

            {
                facingMode: "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                },

                aspectRatio: 1

            },

            qrCodeMessage => {

                handleScannedQRCode(
                    qrCodeMessage
                );

            },

            errorMessage => {

                // Intentionally do nothing - scanner continuously searches

            }

        );


    } catch (error) {

        console.error(error);

        document
            .getElementById("scannerArea")
            .classList.add("hidden");


        scannerRunning =
            false;


        showToast("Camera could not be opened.\n\nPlease make sure QuickPay has permission to use the camera.", "error");

    }

}



/* =========================================================
   SEND — LOOKUP TRANSACTION ID (Manual Entry)
========================================================= */

async function lookupTransactionId() {

    const transactionId =
        document.getElementById("manualTransactionId").value.trim();


    if (!transactionId) {

        showToast("Please enter a Transaction ID.", "error");

        return;
    }


    if (!pendingSessionToken) {

        showToast("Please verify your password first.", "error");

        return;
    }


    if (!window.pendingSendAccount) {

        showToast("Please select a sending account.", "error");

        return;
    }


    try {

        const snapshot =
            await database
                .ref("quickpay_transactions/" + transactionId)
                .once("value");


        const transaction =
            snapshot.val();


        if (!transaction) {

            showToast("Transaction not found.", "error");

            return;
        }


        // Check if this is a receive transaction
        if (transaction.type !== "receive") {

            showToast("Invalid transaction type. Please scan a receive QR code.", "error");

            return;
        }


        if (transaction.status !== "active") {

            if (transaction.status === "done") {
                showToast("This payment has already been completed.", "info");
            } else if (transaction.status === "cancelled") {
                showToast("This payment request has been cancelled.", "info");
            } else {
                showToast("This payment is no longer available.", "info");
            }

            return;
        }


        // Valid transaction found
        window.pendingTransaction = transaction;
        window.pendingTransactionId = transactionId;

        // Display confirmation
        document
            .getElementById("confirmReceiverName")
            .textContent =
                transaction.receiver.accountName;


        document
            .getElementById("confirmReceiverAccount")
            .textContent =
                transaction.receiver.provider +
                " • " +
                transaction.receiver.accountNumber;


        document
            .getElementById("confirmAmount")
            .textContent =
                "MWK " +
                formatMoney(
                    transaction.amount
                );


        const fee =
            Number(
                transaction.fee || 0
            );


        document
            .getElementById("confirmFee")
            .textContent =
                "MWK " +
                formatMoney(fee);


        document
            .getElementById("confirmTotal")
            .textContent =
                "MWK " +
                formatMoney(
                    Number(
                        transaction.amount
                    ) + fee
                );


        // Stop scanner if running
        await stopScanner();


        showPage("confirmPage");


    } catch (error) {

        console.error(error);

        showToast("Could not lookup transaction.", "error");

    }

}



/* =========================================================
   SEND — STOP SCANNER
========================================================= */

async function stopScanner() {

    if (!scanner) {

        scannerRunning =
            false;

        return;
    }


    try {

        if (scannerRunning) {

            await scanner.stop();

        }

    } catch (error) {

        console.log(
            "Scanner stop:",
            error
        );

    }


    try {

        scanner.clear();

    } catch (error) {

        console.log(
            "Scanner clear:",
            error
        );

    }


    scanner =
        null;

    scannerRunning =
        false;


    const area =
        document.getElementById(
            "scannerArea"
        );


    if (area) {

        area.classList.add(
            "hidden"
        );

    }

}



/* =========================================================
   SEND — HANDLE QR
========================================================= */

async function handleScannedQRCode(message) {

    if (scannedPayment) {
        return;
    }


    let qrData;


    try {

        qrData =
            JSON.parse(message);

    } catch (error) {

        showToast("This is not a valid QuickPay QR code.", "error");

        return;
    }


    if (
        !qrData.quickpay ||
        !qrData.transactionId
    ) {

        showToast("This QR code does not belong to QuickPay.", "error");

        return;
    }


    scannedPayment =
        qrData.transactionId;


    await stopScanner();


    try {

        const snapshot =
            await database
                .ref(
                    "quickpay_transactions/" +
                    qrData.transactionId
                )
                .once("value");


        const transaction =
            snapshot.val();


        if (!transaction) {

            scannedPayment =
                null;

            showToast("Payment request could not be found.", "error");

            return;
        }


        if (
            transaction.status !==
            "active"
        ) {

            scannedPayment =
                null;

            if (
                transaction.status ===
                "done"
            ) {

                showToast("Payment already completed.", "info");

            } else if (
                transaction.status ===
                "cancelled"
            ) {

                showToast("This payment request has been cancelled.", "info");

            } else {

                showToast("This payment is no longer available.", "info");

            }

            return;
        }


        if (!window.pendingSendAccount) {

            showToast("Please verify your password first.", "error");

            scannedPayment = null;

            return;
        }


        window.pendingTransaction =
            transaction;


        window.pendingTransactionId =
            qrData.transactionId;


        document
            .getElementById(
                "confirmReceiverName"
            )
            .textContent =
                transaction.receiver.accountName;


        document
            .getElementById(
                "confirmReceiverAccount"
            )
            .textContent =
                transaction.receiver.provider +
                " • " +
                transaction.receiver.accountNumber;


        document
            .getElementById(
                "confirmAmount"
            )
            .textContent =
                "MWK " +
                formatMoney(
                    transaction.amount
                );


        const fee =
            Number(
                transaction.fee || 0
            );


        document
            .getElementById(
                "confirmFee"
            )
            .textContent =
                "MWK " +
                formatMoney(fee);


        document
            .getElementById(
                "confirmTotal"
            )
            .textContent =
                "MWK " +
                formatMoney(
                    Number(
                        transaction.amount
                    ) + fee
                );


        showPage(
            "confirmPage"
        );


    } catch (error) {

        console.error(error);

        scannedPayment =
            null;

        showToast("Could not read the payment information.", "error");

    }

}



/* =========================================================
   SEND — CONFIRM PAYMENT
========================================================= */

async function confirmPayment() {

    const transactionId =
        window.pendingTransactionId;


    const transaction =
        window.pendingTransaction;


    const sendAccount =
        window.pendingSendAccount;


    if (
        !transactionId ||
        !transaction ||
        !sendAccount
    ) {

        showToast("Payment information is missing.", "error");

        return;
    }


    if (!pendingSessionToken) {

        showToast("Session expired. Please verify your password again.", "error");

        cancelConfirmation();

        return;
    }


    // Perform the actual money transfer
    const result = await sendMoney(
        pendingSessionToken,
        transaction.receiver.accountNumber,
        transaction.amount,
        transaction.fee || 20
    );


    if (!result.success) {

        showToast("❌ " + result.message, "error");

        return;
    }


    // Update the Firebase transaction status
    const ref =
        database.ref(
            "quickpay_transactions/" +
            transactionId
        );


    try {

        await ref.transaction(
            current => {

                if (!current) {
                    return current;
                }

                if (current.status !== "active") {
                    return;
                }

                const now = new Date();

                current.status = "done";

                current.sender = {
                    provider: sendAccount.provider,
                    accountNumber: sendAccount.number,
                    accountName: sendAccount.name,
                    accountId: sendAccount.id
                };

                current.completedDate = now.toLocaleDateString();
                current.completedTime = now.toLocaleTimeString();
                current.completedAt = now.toISOString();
                current.senderTransactionId = "SEND_" + Date.now();

                return current;
            }
        );


        // Update local transaction record
        const sentRecord = {
            id: "local_" + Date.now(),
            type: "sent",
            status: "done",
            amount: Number(transaction.amount),
            fee: Number(transaction.fee || 0),
            total: Number(transaction.amount) + Number(transaction.fee || 0),
            provider: transaction.receiver.provider,
            name: transaction.receiver.accountName,
            accountNumber: transaction.receiver.accountNumber,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            transactionId: transactionId
        };

        localTransactions.unshift(sentRecord);
        saveLocalTransactions();


        // Update the local account balance
        const accountToUpdate = accounts.find(a => a.id === sendAccount.id);
        if (accountToUpdate) {
            accountToUpdate.balance = result.newBalance;
            saveAccounts();
            renderAccounts();
        }


        showSendSuccess(transaction);


        clearPendingPayment();


    } catch (error) {

        console.error(error);

        showToast("Payment could not be completed: " + error.message, "error");

    }

}



/* =========================================================
   SEND — SUCCESS
========================================================= */

function showSendSuccess(transaction) {

    const amount =
        formatMoney(
            Number(
                transaction.amount
            )
        );


    const receiver =
        transaction.receiver;


    showToast(
        "✅ Payment successful!\n\n" +
        "Sent MWK " +
        amount +
        "\n" +
        "To: " +
        receiver.accountName +
        "\n" +
        receiver.provider +
        " " +
        receiver.accountNumber,
        "success"
    );


    goHome();
}



/* =========================================================
   SEND — CANCEL CONFIRMATION
========================================================= */

function cancelConfirmation() {

    clearPendingPayment();

    showPage(
        "sendPage"
    );
}


function clearPendingPayment() {

    scannedPayment =
        null;

    pendingSessionToken =
        null;

    window.pendingSendAccount =
        null;

    window.pendingTransaction =
        null;

    window.pendingTransactionId =
        null;

    document.getElementById("manualTransactionId").value = "";
}



/* =========================================================
   TRANSACTIONS
========================================================= */

function showTransactions(filter) {

    transactionFilter =
        filter;


    document
        .querySelectorAll(".tab")
        .forEach(tab => {

            tab.classList.remove(
                "active"
            );

        });


    if (filter === "all") {

        document
            .getElementById("allTab")
            .classList.add("active");

    }

    if (filter === "sent") {

        document
            .getElementById("sentTab")
            .classList.add("active");

    }

    if (filter === "received") {

        document
            .getElementById("receivedTab")
            .classList.add("active");

    }


    renderTransactions();
}


function renderTransactions() {

    const container =
        document.getElementById(
            "transactionsList"
        );


    if (!container) return;


    let records =
        [...localTransactions];


    if (
        transactionFilter !==
        "all"
    ) {

        records =
            records.filter(
                item =>
                    item.type ===
                    transactionFilter
            );

    }


    if (records.length === 0) {

        container.innerHTML = `

            <div class="empty-transactions">

                <strong>
                    No transactions yet
                </strong>

                <p>
                    Your sent and received payments
                    will appear here.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML = "";


    records.forEach(transaction => {

        const item =
            document.createElement(
                "div"
            );


        item.className =
            "transaction-item";


        const isSent =
            transaction.type ===
            "sent";


        const sign =
            isSent
                ? "-"
                : "+";


        const moneyClass =
            isSent
                ? "money-out"
                : "money-in";


        const title =
            isSent
                ? "Sent to " +
                  transaction.name
                : "Received from " +
                  transaction.name;


        item.innerHTML = `

            <div class="transaction-top">

                <div>

                    <strong>
                        ${escapeHtml(title)}
                    </strong>

                    <span>
                        ${escapeHtml(
                            transaction.provider || ""
                        )}
                        •
                        ${escapeHtml(
                            transaction.accountNumber || ""
                        )}
                    </span>

                </div>

                <strong class="${moneyClass}">
                    ${sign} MWK
                    ${formatMoney(
                        transaction.amount
                    )}
                </strong>

            </div>


            <span class="transaction-status transaction-done">
                Completed
            </span>


            <div class="transaction-bottom">

                <span>
                    ${escapeHtml(
                        transaction.date || ""
                    )}
                </span>

                <span>
                    ${escapeHtml(
                        transaction.time || ""
                    )}
                </span>

            </div>

        `;


        container.appendChild(item);

    });
}



/* =========================================================
   HELPERS
========================================================= */

function formatMoney(value) {

    return Number(value || 0)
        .toLocaleString(
            "en-MW",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        );
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}



/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        renderAccounts();

        renderTransactions();

        toggleNationalId();

    }
);
