const axios = require('axios');

async function trigger() {
  try {
    const res = await axios.post('http://localhost:3000/api/refresh');
    console.log(res.data);
  } catch (e) {
    console.error("Failed:", e.message);
  }
}
trigger();

