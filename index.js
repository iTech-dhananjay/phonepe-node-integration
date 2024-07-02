const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cors = require('cors');
const uniqid = require('uniqid');

const app = express();
const PORT = process.env.PORT || 3000;

const MERCHANT_ID = "PGTESTPAYUAT";
const PHONE_PE_HOST_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay";
const SALT_KEY = "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399";
const SALT_INDEX = 1;
const APP_BE_URL = "http://localhost:3002";

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.send("PhonePe Integration APIs!");
});

app.get("/pay", async function (req, res, next) {
  const amount = 1000;
  const userId = "MUID123";
  const merchantTransactionId = uniqid();

  const normalPayload = {
    merchantId: MERCHANT_ID,
    merchantTransactionId: merchantTransactionId,
    merchantUserId: userId,
    amount: amount * 100,
    redirectUrl: `${APP_BE_URL}/payment/validate/${merchantTransactionId}`,
    redirectMode: "REDIRECT",
    mobileNumber: "9999999999",
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  const bufferObj = Buffer.from(JSON.stringify(normalPayload), "utf8");
  const base64EncodedPayload = bufferObj.toString("base64");

  const string = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
  const sha256_val = crypto.createHash('sha256').update(string).digest('hex');
  const xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

  const requestData = {
    request: base64EncodedPayload,
  };

  const requestConfig = {
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": xVerifyChecksum,
      "Accept": "application/json",
    },
  };

  try {
    const response = await axios.post(`${PHONE_PE_HOST_URL}/pg/v1/pay`, requestData, requestConfig);
    res.redirect(response.data.data.instrumentResponse.redirectInfo.url);
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log('Rate limit hit, retrying...');
      res.status(429).send({ error: 'Rate limit hit, please try again later.' });
    } else {
      console.error('Payment failed:', error.message);
      res.status(500).send({ error: 'Payment failed, please try again later.' });
    }
  }
});


// endpoint to check the status of payment
app.get("/payment/validate/:merchantTransactionId", async function (req, res) {
  const { merchantTransactionId } = req.params;
  // check the status of the payment using merchantTransactionId
  if (merchantTransactionId) {
    let statusUrl =
      `${PHONE_PE_HOST_URL}/pg/v1/status/${MERCHANT_ID}/` +
      merchantTransactionId;

    // generate X-VERIFY
    let string =
      `/pg/v1/status/${MERCHANT_ID}/` + merchantTransactionId + SALT_KEY;
    let sha256_val = sha256(string);
    let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

    axios
      .get(statusUrl, {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          "X-MERCHANT-ID": merchantTransactionId,
          accept: "application/json",
        },
      })
      .then(function (response) {
        console.log("response->", response.data);
        if (response.data && response.data.code === "PAYMENT_SUCCESS") {
          // redirect to FE payment success status page
          res.send(response.data);
        } else {
          // redirect to FE payment failure / pending status page
        }
      })
      .catch(function (error) {
        // redirect to FE payment failure / pending status page
        res.send(error);
      });
  } else {
    res.send("Sorry!! Error");
  }
});

// Starting the server
const port = 3002;
app.listen(port, () => {
  console.log(`PhonePe application listening on port ${port}`);
});
