/* ==========================================
   QUICKPAY
   Receiver QR Payment Model
   ========================================== */


/* ==========================================
   FIREBASE
   ========================================== */

const firebaseConfig = {

    apiKey:
        "AIzaSyC9qC5Q9SRO5hrHMRywxAiQQ--uYdIXL57fw",

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


firebase.initializeApp(
    firebaseConfig
);


const database =
    firebase.database();



/* ==========================================
   GLOBAL VARIABLES
   ========================================== */

let scanner = null;

let scannerRunning = false;

let currentReceiveTransactionId = null;

let currentPaymentRequest = null;

let selectedPayAccount = null;

let transactionListener = null;

let transactionType = "sent";



/* ==========================================
   LOCAL ACCOUNTS
   ========================================== */

function getAccounts() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "quickpay_accounts"
            )
        ) || [];

    } catch (error) {

        return [];

    }

}


function saveAccounts(accounts) {

    localStorage.setItem(
        "quickpay_accounts",
        JSON.stringify(accounts)
    );

}


function getTransactions() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "quickpay_transactions"
            )
        ) || [];

    } catch (error) {

        return [];

    }

}


function saveTransactions(transactions) {

    localStorage.setItem(
        "quickpay_transactions",
        JSON.stringify(transactions)
    );

}



/* ==========================================
   SCREEN NAVIGATION
   ========================================== */

function showScreen(screenName) {

    document
        .querySelectorAll(".screen")
        .forEach(screen => {

            screen.classList.remove(
                "active"
            );

        });


    const screen =
        document.getElementById(
            screenName
        );


    if (!screen) {

        return;

    }


    screen.classList.add(
        "active"
    );


    if (
        screenName !== "scanner" &&
        scannerRunning
    ) {

        stopScanner();

    }


    if (
        screenName === "home"
    ) {

        loadAccounts();

        loadBalance();

    }


    if (
        screenName === "accounts"
    ) {

        loadAccounts();

    }


    if (
        screenName === "receive"
    ) {

        loadReceiveAccounts();

    }


    if (
        screenName === "pay"
    ) {

        loadPayAccounts();

    }


    if (
        screenName === "transactions"
    ) {

        loadTransactions();

    }

}



/* ==========================================
   TOAST
   ========================================== */

function showToast(
    title,
    message
) {

    const toast =
        document.getElementById(
            "toast"
        );

    document.getElementById(
        "toastTitle"
    ).textContent = title;

    document.getElementById(
        "toastMessage"
    ).textContent = message;


    toast.classList.add(
        "show"
    );


    setTimeout(() => {

        toast.classList.remove(
            "show"
        );

    }, 3000);

}



/* ==========================================
   ACCOUNT REGISTRATION
   ========================================== */

document
    .getElementById("accountForm")
    .addEventListener(
        "submit",
        function(event) {

            event.preventDefault();


            const provider =
                document
                    .getElementById(
                        "provider"
                    )
                    .value
                    .trim();


            const accountNumber =
                document
                    .getElementById(
                        "accountNumber"
                    )
                    .value
                    .trim();


            const accountName =
                document
                    .getElementById(
                        "accountName"
                    )
                    .value
                    .trim();


            const pin =
                document
                    .getElementById(
                        "accountPin"
                    )
                    .value
                    .trim();


            if (
                !provider ||
                !accountNumber ||
                !accountName ||
                !pin
            ) {

                showToast(
                    "Missing information",
                    "Please complete all fields."
                );

                return;

            }


            const accounts =
                getAccounts();


            accounts.push({

                id:
                    "ACC-" +
                    Date.now(),

                provider:
                    provider,

                accountNumber:
                    accountNumber,

                accountName:
                    accountName,

                /*
                   Prototype only.

                   Never store a real
                   mobile-money PIN here.
                */

                demoPin:
                    pin

            });


            saveAccounts(
                accounts
            );


            document
                .getElementById(
                    "accountForm"
                )
                .reset();


            loadAccounts();


            showToast(
                "Account added",
                "Your account has been registered."
            );

        }
    );



/* ==========================================
   LOAD ACCOUNTS
   ========================================== */

function loadAccounts() {

    const accounts =
        getAccounts();


    const list =
        document.getElementById(
            "accountsList"
        );


    const home =
        document.getElementById(
            "homeAccounts"
        );


    if (!accounts.length) {

        list.innerHTML =
            '<div class="empty">No accounts registered yet.</div>';

        home.innerHTML =
            '<div class="empty">Add an account to get started.</div>';

        return;

    }


    list.innerHTML =
        accounts
            .map(account => {

                return `

                    <div class="account-item">

                        <strong>
                            ${escapeHTML(account.provider)}
                        </strong>

                        <span>
                            ${escapeHTML(account.accountName)}
                        </span>

                        <span>
                            ${escapeHTML(maskAccount(account.accountNumber))}
                        </span>

                    </div>

                `;

            })
            .join("");


    home.innerHTML =
        accounts
            .map(account => {

                return `

                    <div class="account-item">

                        <strong>
                            ${escapeHTML(account.provider)}
                        </strong>

                        <span>
                            ${escapeHTML(account.accountName)}
                            •
                            ${escapeHTML(maskAccount(account.accountNumber))}
                        </span>

                    </div>

                `;

            })
            .join("");

}



/* ==========================================
   RECEIVE ACCOUNTS
   ========================================== */

function loadReceiveAccounts() {

    const select =
        document.getElementById(
            "receiveAccount"
        );


    const accounts =
        getAccounts();


    select.innerHTML =
        '<option value="">Select receiving account</option>';


    accounts.forEach(
        (account, index) => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                index;


            option.textContent =
                account.provider +
                " • " +
                maskAccount(
                    account.accountNumber
                ) +
                " • " +
                account.accountName;


            select.appendChild(
                option
            );

        }
    );

}



/* ==========================================
   PAY ACCOUNTS
   ========================================== */

function loadPayAccounts() {

    const select =
        document.getElementById(
            "payAccount"
        );


    const accounts =
        getAccounts();


    select.innerHTML =
        '<option value="">Select account</option>';


    accounts.forEach(
        (account, index) => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                index;


            option.textContent =
                account.provider +
                " • " +
                maskAccount(
                    account.accountNumber
                ) +
                " • " +
                account.accountName;


            select.appendChild(
                option
            );

        }
    );

}



/* ==========================================
   RECEIVE / GENERATE QR
   ========================================== */

document
    .getElementById("receiveForm")
    .addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const index =
                document
                    .getElementById(
                        "receiveAccount"
                    )
                    .value;


            const amount =
                Number(
                    document
                        .getElementById(
                            "receiveAmount"
                        )
                        .value
                );


            const accounts =
                getAccounts();


            if (
                index === "" ||
                !accounts[index]
            ) {

                showToast(
                    "Select account",
                    "Please select a receiving account."
                );

                return;

            }


            if (
                !amount ||
                amount <= 0
            ) {

                showToast(
                    "Invalid amount",
                    "Enter a valid amount."
                );

                return;

            }


            const account =
                accounts[index];


            const transactionId =
                generateTransactionId();


            const createdAt =
                new Date()
                    .toISOString();


            /*
               Receiver creates the payment request.

               The QR contains ONLY the
               transaction ID.

               It does NOT contain any PIN.
            */

            const paymentRequest = {

                id:
                    transactionId,

                type:
                    "payment_request",

                receiver: {

                    provider:
                        account.provider,

                    accountNumber:
                        account.accountNumber,

                    accountName:
                        account.accountName

                },

                amount:
                    amount,

                fee:
                    calculateFee(
                        amount
                    ),

                status:
                    "active",

                createdAt:
                    createdAt,

                receiverCompleted:
                    false

            };


            currentReceiveTransactionId =
                transactionId;


            currentPaymentRequest =
                paymentRequest;


            try {

                await database
                    .ref(
                        "transactions/" +
                        transactionId
                    )
                    .set(
                        paymentRequest
                    );


                createQRCode(
                    transactionId
                );


                document.getElementById(
                    "qrProvider"
                ).textContent =
                    account.provider;


                document.getElementById(
                    "qrAccount"
                ).textContent =
                    account.accountNumber;


                document.getElementById(
                    "qrName"
                ).textContent =
                    account.accountName;


                document.getElementById(
                    "qrAmount"
                ).textContent =
                    formatMoney(amount);


                document.getElementById(
                    "receiveForm"
                ).style.display =
                    "none";


                document.getElementById(
                    "receiveQRArea"
                ).style.display =
                    "block";


                watchReceiveTransaction(
                    transactionId
                );


                showToast(
                    "QR created",
                    "Waiting for payment."
                );

            } catch (error) {

                console.error(
                    error
                );

                showToast(
                    "Error",
                    "Could not create payment request."
                );

            }

        }
    );



/* ==========================================
   QR GENERATOR
   ========================================== */

function createQRCode(
    transactionId
) {

    const container =
        document.getElementById(
            "qrcode"
        );


    container.innerHTML = "";


    new QRCode(
        container,
        {

            text:
                transactionId,

            width:
                300,

            height:
                300,

            colorDark:
                "#000000",

            colorLight:
                "#ffffff",

            correctLevel:
                QRCode.CorrectLevel.H

        }
    );

}



/* ==========================================
   QR PNG CREATOR
   ========================================== */

function getQRCanvas() {

    const qr =
        document.getElementById(
            "qrcode"
        );


    if (!qr) {

        return null;

    }


    const original =
        qr.querySelector(
            "canvas"
        );


    if (!original) {

        return null;

    }


    /*
       Large white margin.

       This prevents QR cropping and
       makes the saved/shared image
       easier to scan.
    */

    const output =
        document.createElement(
            "canvas"
        );


    const padding =
        100;


    const size =
        Math.max(
            original.width,
            original.height
        );


    output.width =
        size +
        padding * 2;


    output.height =
        size +
        padding * 2;


    const ctx =
        output.getContext(
            "2d"
        );


    ctx.fillStyle =
        "#ffffff";


    ctx.fillRect(
        0,
        0,
        output.width,
        output.height
    );


    ctx.drawImage(

        original,

        padding,

        padding,

        size,

        size

    );


    return output;

}



/* ==========================================
   SAVE QR
   ========================================== */

function saveQR() {

    const canvas =
        getQRCanvas();


    if (!canvas) {

        showToast(
            "QR unavailable",
            "Generate a QR first."
        );

        return;

    }


    const link =
        document.createElement(
            "a"
        );


    link.download =
        "QuickPay-" +
        currentReceiveTransactionId +
        ".png";


    link.href =
        canvas.toDataURL(
            "image/png"
        );


    link.click();


    showToast(
        "QR saved",
        "The QR image has been downloaded."
    );

}



/* ==========================================
   SHARE QR
   ========================================== */

async function shareQR() {

    const canvas =
        getQRCanvas();


    if (!canvas) {

        showToast(
            "QR unavailable",
            "Generate a QR first."
        );

        return;

    }


    try {

        const blob =
            await new Promise(
                resolve =>
                    canvas.toBlob(
                        resolve,
                        "image/png"
                    )
            );


        const file =
            new File(

                [
                    blob
                ],

                "QuickPay-" +
                currentReceiveTransactionId +
                ".png",

                {
                    type:
                        "image/png"
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
                    "QuickPay Payment QR",

                text:
                    "Scan this QuickPay QR to make the payment.",

                files:
                    [file]

            });

        } else {

            saveQR();

            showToast(
                "Share unavailable",
                "QR image downloaded instead."
            );

        }

    } catch (error) {

        if (
            error.name !==
            "AbortError"
        ) {

            console.error(
                error
            );

            showToast(
                "Share failed",
                "Unable to share the QR image."
            );

        }

    }

}



/* ==========================================
   WATCH RECEIVER TRANSACTION
   ========================================== */

function watchReceiveTransaction(
    transactionId
) {

    if (
        transactionListener
    ) {

        transactionListener.off();

    }


    transactionListener =
        database.ref(
            "transactions/" +
            transactionId
        );


    transactionListener.on(
        "value",
        snapshot => {

            const data =
                snapshot.val();


            if (!data) {

                return;

            }


            if (
                data.status ===
                "completed"
            ) {

                stopReceiveWatcher();


                const received =
                    Number(
                        data.amount
                    );


                addReceivedTransaction(
                    data
                );


                showReceivedSuccess(
                    data
                );

            }

        }
    );

}



/* ==========================================
   RECEIVER SUCCESS
   ========================================== */

function showReceivedSuccess(
    data
) {

    document.getElementById(
        "receivedAmount"
    ).textContent =
        formatMoney(
            data.amount
        );


    document.getElementById(
        "receivedFrom"
    ).textContent =
        data.sender &&
        data.sender.accountName
            ?
        data.sender.accountName
            :
        "QuickPay Customer";


    document.getElementById(
        "receivedProvider"
    ).textContent =
        data.sender &&
        data.sender.provider
            ?
        data.sender.provider
            :
        "-";


    document.getElementById(
        "receivedAccount"
    ).textContent =
        data.sender &&
        data.sender.accountNumber
            ?
        data.sender.accountNumber
            :
        "-";


    document.getElementById(
        "receivedDate"
    ).textContent =
        formatDate(
            data.completedAt
        );


    document.getElementById(
        "receiveQRArea"
    ).style.display =
        "none";


    showScreen(
        "receiveSuccess"
    );

}



/* ==========================================
   STOP RECEIVER WATCHER
   ========================================== */

function stopReceiveWatcher() {

    if (
        transactionListener
    ) {

        transactionListener.off();

        transactionListener =
            null;

    }

}



/* ==========================================
   DONE RECEIVING
   ========================================== */

function finishReceive() {

    showToast(
        "QR still active",
        "The payment request remains active."
    );


    showScreen(
        "home"
    );

}



/* ==========================================
   CANCEL PAYMENT REQUEST
   ========================================== */

async function cancelReceivePayment() {

    if (
        !currentReceiveTransactionId
    ) {

        showScreen(
            "home"
        );

        return;

    }


    try {

        await database
            .ref(
                "transactions/" +
                currentReceiveTransactionId +
                "/status"
            )
            .set(
                "cancelled"
            );


        stopReceiveWatcher();


        resetReceivePage();


        showToast(
            "Payment cancelled",
            "The QR payment request was cancelled."
        );


        showScreen(
            "home"
        );

    } catch (error) {

        console.error(
            error
        );

        showToast(
            "Error",
            "Could not cancel payment."
        );

    }

}



/* ==========================================
   PAY FORM
   ========================================== */

document
    .getElementById("payForm")
    .addEventListener(
        "submit",
        function(event) {

            event.preventDefault();


            const index =
                document
                    .getElementById(
                        "payAccount"
                    )
                    .value;


            const pin =
                document
                    .getElementById(
                        "payPin"
                    )
                    .value
                    .trim();


            const accounts =
                getAccounts();


            if (
                index === "" ||
                !accounts[index]
            ) {

                showToast(
                    "Select account",
                    "Select the account to pay from."
                );

                return;

            }


            if (!pin) {

                showToast(
                    "PIN required",
                    "Enter your account PIN."
                );

                return;

            }


            const account =
                accounts[index];


            /*
               Prototype PIN verification.

               Real provider PINs should NEVER
               be handled by QuickPay this way.
            */

            if (
                account.demoPin !==
                pin
            ) {

                showToast(
                    "Incorrect PIN",
                    "The demo account PIN is incorrect."
                );

                return;

            }


            selectedPayAccount =
                account;


            document.getElementById(
                "payPin"
            ).value = "";


            showScreen(
                "scanner"
            );


            startScanner();

        }
    );



/* ==========================================
   START SCANNER
   ========================================== */

async function startScanner() {

    stopScanner();


    scanner =
        new Html5Qrcode(
            "reader"
        );


    try {

        await scanner.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps:
                    10,

                qrbox:
                    {
                        width:
                            250,

                        height:
                            250
                    }

            },

            decodedText => {

                handleScannedQR(
                    decodedText
                );

            },

            errorMessage => {

                // Normal scanner
                // frame errors ignored.

            }

        );


        scannerRunning =
            true;


        document.getElementById(
            "scanMessage"
        ).textContent =
            "Point the camera at the payment QR code.";

    } catch (error) {

        console.error(
            error
        );


        document.getElementById(
            "scanMessage"
        ).textContent =
            "Camera could not be opened. Check camera permission.";

    }

}



/* ==========================================
   STOP SCANNER
   ========================================== */

async function stopScanner() {

    if (!scanner) {

        return;

    }


    try {

        if (
            scannerRunning
        ) {

            await scanner.stop();

        }

    } catch (error) {

        console.log(
            "Scanner stopped."
        );

    }


    try {

        scanner.clear();

    } catch (error) {

        // Ignore.
    }


    scanner =
        null;

    scannerRunning =
        false;

}



/* ==========================================
   CANCEL SCAN
   ========================================== */

function cancelScan() {

    stopScanner();

    showScreen(
        "pay"
    );

}



/* ==========================================
   HANDLE QR
   ========================================== */

async function handleScannedQR(
    transactionId
) {

    stopScanner();


    transactionId =
        transactionId.trim();


    document.getElementById(
        "scanMessage"
    ).textContent =
        "Checking payment request...";


    try {

        const snapshot =
            await database
                .ref(
                    "transactions/" +
                    transactionId
                )
                .once(
                    "value"
                );


        const request =
            snapshot.val();


        if (!request) {

            showToast(
                "Invalid QR",
                "This QuickPay payment request was not found."
            );


            showScreen(
                "pay"
            );


            return;

        }


        if (
            request.status ===
            "completed"
        ) {

            alert(
                "Payment already completed.\n\nThis QR cannot be used again."
            );


            showScreen(
                "home"
            );


            return;

        }


        if (
            request.status ===
            "cancelled"
        ) {

            alert(
                "Payment cancelled.\n\nThis QR is no longer active."
            );


            showScreen(
                "home"
            );


            return;

        }


        if (
            request.type !==
            "payment_request"
        ) {

            showToast(
                "Invalid payment",
                "This QR is not a QuickPay payment request."
            );


            showScreen(
                "home"
            );


            return;

        }


        currentPaymentRequest =
            request;


        showPaymentConfirmation(
            request
        );

    } catch (error) {

        console.error(
            error
        );


        showToast(
            "Error",
            "Could not read payment request."
        );


        showScreen(
            "home"
        );

    }

}



/* ==========================================
   PAYMENT CONFIRMATION
   ========================================== */

function showPaymentConfirmation(
    request
) {

    const amount =
        Number(
            request.amount
        );


    const fee =
        Number(
            request.fee ||
            calculateFee(amount)
        );


    const total =
        amount +
        fee;


    document.getElementById(
        "confirmAmount"
    ).textContent =
        formatMoney(
            amount
        );


    document.getElementById(
        "confirmName"
    ).textContent =
        request.receiver.accountName;


    document.getElementById(
        "confirmProvider"
    ).textContent =
        request.receiver.provider;


    document.getElementById(
        "confirmAccount"
    ).textContent =
        request.receiver.accountNumber;


    document.getElementById(
        "confirmFee"
    ).textContent =
        formatMoney(
            fee
        );


    document.getElementById(
        "confirmTotal"
    ).textContent =
        formatMoney(
            total
        );


    showScreen(
        "confirmation"
    );

}



/* ==========================================
   CONFIRM PAYMENT
   ========================================== */

async function confirmPayment() {

    if (
        !currentPaymentRequest
    ) {

        return;

    }


    const request =
        currentPaymentRequest;


    const transactionRef =
        database.ref(
            "transactions/" +
            request.id
        );


    try {

        const snapshot =
            await transactionRef.once(
                "value"
            );


        const latest =
            snapshot.val();


        if (!latest) {

            showToast(
                "Error",
                "Payment request no longer exists."
            );

            showScreen(
                "home"
            );

            return;

        }


        if (
            latest.status !==
            "active"
        ) {

            alert(
                "Payment is no longer active."
            );


            showScreen(
                "home"
            );


            return;

        }


        const amount =
            Number(
                latest.amount
            );


        const fee =
            Number(
                latest.fee ||
                calculateFee(
                    amount
                )
            );


        const total =
            amount +
            fee;


        const completedAt =
            new Date()
                .toISOString();


        const updatedData = {

            ...latest,

            status:
                "completed",

            sender: {

                provider:
                    selectedPayAccount.provider,

                accountNumber:
                    selectedPayAccount.accountNumber,

                accountName:
                    selectedPayAccount.accountName

            },

            fee:
                fee,

            total:
                total,

            completedAt:
                completedAt

        };


        /*
           For the prototype we update the
           transaction after confirmation.

           A production implementation should
           use authenticated server-side logic
           / provider APIs to prevent fraud.
        */

        await transactionRef.set(
            updatedData
        );


        addSentTransaction(
            updatedData
        );


        showPaymentSuccess(
            updatedData
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "Payment failed",
            "Could not complete the payment."
        );

    }

}



/* ==========================================
   CANCEL CONFIRMATION
   ========================================== */

function cancelConfirmation() {

    currentPaymentRequest =
        null;


    showScreen(
        "pay"
    );

}



/* ==========================================
   PAYMENT SUCCESS
   ========================================== */

function showPaymentSuccess(
    data
) {

    document.getElementById(
        "successAmount"
    ).textContent =
        formatMoney(
            data.amount
        );


    document.getElementById(
        "successName"
    ).textContent =
        data.receiver.accountName;


    document.getElementById(
        "successProvider"
    ).textContent =
        data.receiver.provider;


    document.getElementById(
        "successAccount"
    ).textContent =
        data.receiver.accountNumber;


    document.getElementById(
        "successFee"
    ).textContent =
        formatMoney(
            data.fee
        );


    document.getElementById(
        "successTotal"
    ).textContent =
        formatMoney(
            data.total
        );


    showScreen(
        "paymentSuccess"
    );

}



/* ==========================================
   TRANSACTION STORAGE
   ========================================== */

function addSentTransaction(
    data
) {

    const transactions =
        getTransactions();


    const exists =
        transactions.some(
            transaction =>
                transaction.id ===
                data.id
        );


    if (exists) {

        return;

    }


    transactions.unshift({

        id:
            data.id,

        direction:
            "sent",

        amount:
            data.amount,

        fee:
            data.fee,

        total:
            data.total,

        provider:
            data.receiver.provider,

        account:
            data.receiver.accountNumber,

        name:
            data.receiver.accountName,

        date:
            data.completedAt,

        status:
            "completed"

    });


    saveTransactions(
        transactions
    );

}



function addReceivedTransaction(
    data
) {

    const transactions =
        getTransactions();


    const exists =
        transactions.some(
            transaction =>
                transaction.id ===
                data.id
        );


    if (exists) {

        return;

    }


    transactions.unshift({

        id:
            data.id,

        direction:
            "received",

        amount:
            data.amount,

        fee:
            data.fee,

        provider:
            data.receiver.provider,

        account:
            data.receiver.accountNumber,

        name:
            data.receiver.accountName,

        from:
            data.sender
                ?
            data.sender.accountName
                :
            "Customer",

        date:
            data.completedAt,

        status:
            "completed"

    });


    saveTransactions(
        transactions
    );

}



/* ==========================================
   TRANSACTION LIST
   ========================================== */

function loadTransactions() {

    const list =
        document.getElementById(
            "transactionList"
        );


    const transactions =
        getTransactions()
            .filter(
                transaction =>
                    transaction.direction ===
                    transactionType
            );


    if (!transactions.length) {

        list.innerHTML =
            '<div class="empty">No transactions yet.</div>';

        return;

    }


    list.innerHTML =
        transactions
            .map(
                transaction => {

                    if (
                        transaction.direction ===
                        "sent"
                    ) {

                        return `

                            <div class="transaction-item">

                                <div class="transaction-top">

                                    <div>

                                        <strong>
                                            ${escapeHTML(transaction.name)}
                                        </strong>

                                        <span>
                                            ${escapeHTML(transaction.provider)}
                                            •
                                            ${escapeHTML(maskAccount(transaction.account))}
                                        </span>

                                    </div>

                                    <strong class="money-out">

                                        -
                                        ${formatMoney(transaction.amount)}

                                    </strong>

                                </div>

                                <span class="transaction-status transaction-done">
                                    Completed
                                </span>

                                <div class="transaction-bottom">

                                    <span>
                                        ${formatDate(transaction.date)}
                                    </span>

                                    <span>
                                        ${escapeHTML(transaction.id)}
                                    </span>

                                </div>

                            </div>

                        `;

                    }


                    return `

                        <div class="transaction-item">

                            <div class="transaction-top">

                                <div>

                                    <strong>
                                        ${escapeHTML(transaction.from || "Customer")}
                                    </strong>

                                    <span>
                                        ${escapeHTML(transaction.provider)}
                                        •
                                        ${escapeHTML(maskAccount(transaction.account))}
                                    </span>

                                </div>

                                <strong class="money-in">

                                    +
                                    ${formatMoney(transaction.amount)}

                                </strong>

                            </div>

                            <span class="transaction-status transaction-done">
                                Received
                            </span>

                            <div class="transaction-bottom">

                                <span>
                                    ${formatDate(transaction.date)}
                                </span>

                                <span>
                                    ${escapeHTML(transaction.id)}
                                </span>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");

}



/* ==========================================
   TRANSACTION TABS
   ========================================== */

function showTransactionType(
    type
) {

    transactionType =
        type;


    document
        .getElementById(
            "sentTab"
        )
        .classList.toggle(
            "active",
            type === "sent"
        );


    document
        .getElementById(
            "receivedTab"
        )
        .classList.toggle(
            "active",
            type === "received"
        );


    loadTransactions();

}



/* ==========================================
   BALANCE
   ========================================== */

function loadBalance() {

    const accounts =
        getAccounts();


    const balance =
        accounts.length
            ?
        25000
            :
        0;


    document.getElementById(
        "homeBalance"
    ).textContent =
        formatMoney(
            balance
        );

}



/* ==========================================
   RESET RECEIVE
   ========================================== */

function resetReceivePage() {

    stopReceiveWatcher();


    currentReceiveTransactionId =
        null;


    currentPaymentRequest =
        null;


    document.getElementById(
        "receiveForm"
    ).reset();


    document.getElementById(
        "receiveForm"
    ).style.display =
        "flex";


    document.getElementById(
        "receiveQRArea"
    ).style.display =
        "none";


    document.getElementById(
        "qrcode"
    ).innerHTML =
        "";

}



/* ==========================================
   FEE CALCULATION
   ========================================== */

function calculateFee(
    amount
) {

    /*
       Mock fee for prototype.

       Later this can be replaced by
       provider-specific fee rules.
    */

    if (
        amount <= 0
    ) {

        return 0;

    }


    return 20;

}



/* ==========================================
   ID GENERATOR
   ========================================== */

function generateTransactionId() {

    return (
        "QP-" +
        Math.random()
            .toString(36)
            .substring(
                2,
                9
            )
            .toUpperCase()
    );

}



/* ==========================================
   MONEY FORMAT
   ========================================== */

function formatMoney(
    amount
) {

    return (
        "MWK " +
        Number(
            amount || 0
        ).toLocaleString(
            "en-US"
        )
    );

}



/* ==========================================
   ACCOUNT MASK
   ========================================== */

function maskAccount(
    account
) {

    const value =
        String(
            account
        );


    if (
        value.length <= 4
    ) {

        return value;

    }


    return (
        "••••" +
        value.slice(
            -4
        )
    );

}



/* ==========================================
   DATE
   ========================================== */

function formatDate(
    value
) {

    if (!value) {

        return "-";

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "-";

    }


    return date.toLocaleString();

}



/* ==========================================
   HTML ESCAPE
   ========================================== */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )

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



/* ==========================================
   INITIALIZE
   ========================================== */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        loadAccounts();

        loadBalance();

        loadReceiveAccounts();

        loadPayAccounts();

    }
);
