/**
 * @file The fake Zode agent.
 *
 * A deterministic stand-in for a real agent: fixed step timings, fixed copy,
 * no randomness. That keeps the Agent view, its haptics and the screenshots
 * reproducible.
 *
 * Events: `task:start`, `task:progress`, `task:done`, `task:error` (plus
 * `task:stopped` for a user cancelled run).
 *
 * @module data/agent
 */

/**
 * @typedef {object} AgentAttachment
 * @property {string} id
 * @property {string} name
 * @property {string} path
 * @property {string} mimeType
 * @property {number} size
 * @property {string} source
 */

/**
 * @typedef {object} AgentTask
 * @property {string} id
 * @property {string} prompt
 * @property {AgentAttachment[]} attachments
 * @property {'running'|'done'|'error'|'stopped'} state
 * @property {string} status
 * @property {number} percent
 * @property {number} startedAt
 * @property {number|null} endedAt
 * @property {string|null} result
 * @property {string|null} error
 */

/**
 * The deterministic plan of a successful run, in milliseconds from the start.
 * @type {{at: number, status: string, percent: number}[]}
 */
export const AGENT_PLAN = [
  { at: 300, status: 'Reading the library…', percent: 15 },
  { at: 800, status: 'Planning the answer…', percent: 35 },
  { at: 1400, status: 'Working on it…', percent: 60 },
  { at: 1900, status: 'Almost there…', percent: 85 },
];

/** Total duration of a successful run, in milliseconds. */
export const AGENT_TOTAL_MS = 2300;

/** Duration of a failing run, in milliseconds. */
export const AGENT_FAILURE_MS = 950;

/**
 * Words in a prompt that make the fake agent fail — handy for testing the
 * error haptic without a real backend.
 * @type {string[]}
 */
export const FAILURE_TRIGGERS = ['fail', 'error', 'break', 'unsupported'];

/**
 * @param {string} prompt
 * @returns {boolean} true when the prompt asks for a failure
 */
export function shouldFail(prompt) {
  const needle = String(prompt ?? '').toLowerCase();
  return FAILURE_TRIGGERS.some((trigger) => needle.includes(trigger));
}

/**
 * A deterministic, prompt aware summary of what the agent did.
 *
 * @param {string} prompt
 * @param {AgentAttachment[]} attachments
 * @returns {string}
 */
export function summarise(prompt, attachments) {
  const subject = String(prompt ?? '').trim() || 'the library';
  const files = attachments.length;
  if (files > 0) {
    return `Reviewed “${subject}” together with ${files} attachment${files === 1 ? '' : 's'} and summarised what matters.`;
  }
  return `Searched the library for “${subject}”, grouped the results and wrote a short summary.`;
}

/**
 * The fake agent engine.
 */
export class AgentEngine {
  /**
   * @param {object} [options]
   * @param {(fn: () => void, ms: number) => any} [options.setTimer]
   * @param {(handle: any) => void} [options.clearTimer]
   * @param {() => number} [options.now]
   */
  constructor({ setTimer = setTimeout, clearTimer = clearTimeout, now = () => Date.now() } = {}) {
    this._setTimer = setTimer;
    this._clearTimer = clearTimer;
    this._now = now;
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    /** @type {AgentTask[]} */
    this.tasks = [];
    /** @type {AgentTask|null} */
    this.current = null;
    this._counter = 0;
    /** @type {any[]} */
    this._timers = [];
  }

  /**
   * Subscribe to an agent event.
   *
   * @param {'task:start'|'task:progress'|'task:done'|'task:error'|'task:stopped'} event
   * @param {(task: AgentTask) => void} cb
   * @returns {() => void} unsubscribe
   */
  on(event, cb) {
    let bucket = this._listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      this._listeners.set(event, bucket);
    }
    bucket.add(cb);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      bucket.delete(cb);
    };
  }

  /**
   * @param {string} event
   * @param {AgentTask} task
   * @returns {void}
   */
  _emit(event, task) {
    const bucket = this._listeners.get(event);
    if (!bucket) return;
    for (const cb of [...bucket]) {
      try {
        cb(task);
      } catch (error) {
        console.error(`[agent] listener for "${event}" threw`, error);
      }
    }
  }

  /**
   * Start a new task. Only one task runs at a time; starting a new one stops
   * the previous run.
   *
   * @param {string} prompt
   * @param {AgentAttachment[]} [attachments]
   * @returns {AgentTask}
   */
  start(prompt, attachments = []) {
    this.stop();

    this._counter += 1;
    /** @type {AgentTask} */
    const task = {
      id: `task-${this._counter}`,
      prompt: String(prompt ?? ''),
      attachments: [...attachments],
      state: 'running',
      status: 'Starting…',
      percent: 0,
      startedAt: this._now(),
      endedAt: null,
      result: null,
      error: null,
    };
    this.tasks.unshift(task);
    this.current = task;

    this._emit('task:start', task);

    const failing = shouldFail(task.prompt);
    const finish = () => {
      task.endedAt = this._now();
      if (failing) {
        task.state = 'error';
        task.status = 'The agent could not finish that.';
        task.error = 'The request could not be completed.';
        this._emit('task:error', task);
      } else {
        task.state = 'done';
        task.status = 'Done';
        task.percent = 100;
        task.result = summarise(task.prompt, task.attachments);
        this._emit('task:done', task);
      }
      if (this.current === task) this.current = null;
    };

    if (failing) {
      this._timers.push(
        this._setTimer(() => {
          task.status = 'Something went wrong…';
          task.percent = 45;
          this._emit('task:progress', task);
        }, Math.round(AGENT_FAILURE_MS / 2)),
      );
      this._timers.push(this._setTimer(finish, AGENT_FAILURE_MS));
      return task;
    }

    for (const step of AGENT_PLAN) {
      this._timers.push(
        this._setTimer(() => {
          if (task.state !== 'running') return;
          task.status = step.status;
          task.percent = step.percent;
          this._emit('task:progress', task);
        }, step.at),
      );
    }
    this._timers.push(this._setTimer(finish, AGENT_TOTAL_MS));
    return task;
  }

  /**
   * Stop the running task.
   * @returns {AgentTask|null} the stopped task
   */
  stop() {
    const task = this.current;
    if (!task) return null;
    for (const timer of this._timers) this._clearTimer(timer);
    this._timers = [];
    task.state = 'stopped';
    task.status = 'Stopped';
    task.endedAt = this._now();
    this.current = null;
    this._emit('task:stopped', task);
    return task;
  }

  /**
   * Attach a file to the running task (contract §8).
   *
   * @param {AgentAttachment} attachment
   * @returns {AgentTask|null} the task the attachment was added to
   */
  addAttachment(attachment) {
    if (!attachment) return null;
    const task = this.current ?? this.tasks[0];
    if (!task) return null;
    if (!task.attachments.some((existing) => existing.id === attachment.id)) {
      task.attachments.push(attachment);
    }
    if (task.state === 'running') {
      task.status = `Reading ${attachment.name}…`;
      this._emit('task:progress', task);
    }
    return task;
  }
}

/**
 * Create an engine.
 * @returns {AgentEngine}
 */
export function createAgentEngine() {
  return new AgentEngine();
}
