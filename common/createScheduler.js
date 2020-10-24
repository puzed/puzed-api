function createScheduler () {
  const jobs = [];

  function add (fn, delay) {
    const job = {
      delay
    };

    job.runner = async () => {
      job.running = true;
      job.lastStarted = Date.now();
      const result = await fn();
      job.lastResult = result;
      job.lastFinished = Date.now();
      job.running = false;
    };

    jobs.push(job);
  }

  const interval = setInterval(() => {
    jobs.forEach(job => {
      if (!job.lastFinished || Date.now() - job.lastFinished > job.delay) {
        job.runner();
      }
    });
  }, 1000);

  function cancelAndStop () {
    clearInterval(interval);
    jobs.splice(0, jobs.length);
  }

  return {
    add,
    cancelAndStop
  };
}

module.exports = createScheduler;
