function createMetricsEngine (context) {
  const data = [];

  async function save () {
    if (Object.keys(data) > 1) {
      const key = Object.keys(data).sort()[0];
      await fs.promises.appendFile('./stats.txt', JSON.stringify(data[key]));
      delete data[key];
    }

    setTimeout(save, 5000);
  }
  save();

  function inc (metric) {
    const minute = Math.floor(Date.now() / 60000);

    data[minute] = data[minute] || [];
    data[minute].push([metric, Date.now()]);
  }

  function

  return] {
    inc
  }  
}

module.exports = createMetricsEngine
