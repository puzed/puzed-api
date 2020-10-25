function createScheduler () {
  const jobs = [];
  let destroyed = false;

  function add (fn, delay) {
    let lastRun;

    async function run(){
      if (destroyed) {
        return;
      }

      lastRun = Date.now();
      try {
        await fn();
      } catch (error) {
        console.error(error);
      }

      setTimeout(run, Math.max(delay - (Date.now() - lastRun), 0));
    }

    run();
  }

  return {
    add,
    cancelAndStop: () => destroyed = true
  }
}

module.exports = createScheduler;
