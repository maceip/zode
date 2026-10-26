/**
 * @file The Agent view.
 *
 * The task panel: a list of agent tasks, the running task, a composer box and
 * a live region for the agent's status.
 *
 * This is where the haptic programs of `haptics.json` fire:
 *
 *   • `task:start`  → `working` (loops until the task ends)
 *   • `task:done`   → stop `working`, then `done` (the triple roll)
 *   • `task:error`  → stop `working`, then `error` (two dull thuds)
 *   • attachment    → `attach` (and `drop` for a dropped file)
 *
 * @module views/agent
 */

import { createIcon } from '../app/icons.js';
import { h } from '../util/dom.js';

/**
 * @param {object} ctx
 * @param {Document} ctx.doc
 * @param {any} ctx.zode
 * @param {any} ctx.agent
 * @param {() => any[]} [ctx.getAttachments]
 * @returns {{id: string, title: string, el: HTMLElement, handleAttachment: (attachment: any) => void, refresh: () => void, destroy: () => void}}
 */
export function createAgentView(ctx) {
  const { doc, zode, agent } = ctx;

  const el = h(doc, 'section', { class: 'view view-agent', attrs: { 'data-view': 'agent' } });

  // ------------------------------------------------------------------ head
  const head = h(doc, 'div', { class: 'agent-header' });
  head.appendChild(h(doc, 'h2', { class: 'u-label', text: 'Agent' }));
  const headNote = h(doc, 'span', { class: 'agent-note u-label', text: 'Local model · offline' });
  head.appendChild(headNote);

  // ----------------------------------------------------------- running task
  const running = h(doc, 'div', { class: 'agent-running' });
  const runningBeacon = h(doc, 'span', { class: 'agent-beacon' });
  const runningText = h(doc, 'span', { class: 'agent-running-status u-body' });
  const runningBar = h(doc, 'div', { class: 'agent-bar' });
  const runningFill = h(doc, 'div', { class: 'agent-bar-fill' });
  runningBar.appendChild(runningFill);
  const stopButton = h(doc, 'button', {
    class: 'agent-stop',
    attrs: { type: 'button', 'aria-label': 'Stop the running task' },
  });
  stopButton.appendChild(createIcon(doc, 'stop', { size: 14 }));
  stopButton.appendChild(h(doc, 'span', { text: 'Stop' }));
  stopButton.addEventListener('click', () => {
    agent.stop();
  });

  running.appendChild(runningBeacon);
  running.appendChild(runningText);
  running.appendChild(runningBar);
  running.appendChild(stopButton);

  // ------------------------------------------------------------- task list
  const taskList = h(doc, 'ol', { class: 'agent-tasks' });

  // -------------------------------------------------------------- composer
  const composer = h(doc, 'div', { class: 'agent-composer' });
  const prompt = h(doc, 'textarea', {
    class: 'agent-prompt',
    attrs: {
      rows: '2',
      placeholder: 'Ask the agent…',
      'aria-label': 'Agent prompt',
    },
  });
  const composerRow = h(doc, 'div', { class: 'agent-composer-row' });

  const attachButton = h(doc, 'button', {
    class: 'agent-attach',
    attrs: { type: 'button', 'aria-label': 'Attach a file' },
  });
  attachButton.appendChild(createIcon(doc, 'attach', { size: 16 }));
  attachButton.appendChild(h(doc, 'span', { text: 'Attach' }));
  attachButton.addEventListener('click', () => {
    zode
      .attach()
      .then((attachments) => {
        for (const attachment of attachments) handleAttachment(attachment);
      })
      .catch(() => {});
  });

  const runButton = h(doc, 'button', {
    class: 'agent-run',
    attrs: { type: 'button', 'aria-label': 'Run the task' },
  });
  runButton.appendChild(createIcon(doc, 'send', { size: 16 }));
  runButton.appendChild(h(doc, 'span', { text: 'Run' }));

  composerRow.appendChild(attachButton);
  composerRow.appendChild(runButton);
  composer.appendChild(prompt);
  composer.appendChild(composerRow);

  const live = h(doc, 'p', {
    class: 'agent-live',
    attrs: { role: 'status', 'aria-live': 'polite' },
    text: 'The agent is idle.',
  });

  el.appendChild(head);
  el.appendChild(running);
  el.appendChild(taskList);
  el.appendChild(live);
  el.appendChild(composer);

  // -------------------------------------------------------------- behaviour
  const run = () => {
    const text = prompt.value.trim();
    if (!text) {
      live.textContent = 'Type a prompt first.';
      return;
    }
    prompt.value = '';
    agent.start(text, []);
    live.textContent = 'The agent is working on it.';
  };

  runButton.addEventListener('click', run);
  prompt.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault?.();
      run();
    }
  });

  /**
   * An attachment arrived (from the dock, a drop, the share sheet or the
   * picker). The agent gets it and the haptics fire.
   *
   * @param {any} attachment
   * @returns {void}
   */
  const handleAttachment = (attachment) => {
    if (!attachment) return;
    agent.addAttachment(attachment);
    zode.haptic('attach').catch(() => {});
    if (attachment.source === 'drop') {
      zode.haptic('drop').catch(() => {});
    }
    live.textContent = `Attached ${attachment.name}.`;
  };

  // --------------------------------------------------------------- haptics
  const offStart = agent.on('task:start', () => {
    zode.haptic('working', { loop: true }).catch(() => {});
  });

  const offDone = agent.on('task:done', () => {
    zode.hapticStop('working').catch(() => {});
    zode.haptic('done').catch(() => {});
    live.textContent = 'The agent finished.';
  });

  const offError = agent.on('task:error', () => {
    zode.hapticStop('working').catch(() => {});
    zode.haptic('error').catch(() => {});
    live.textContent = 'The agent could not finish that.';
  });

  const offStopped = agent.on('task:stopped', () => {
    zode.hapticStop('working').catch(() => {});
    live.textContent = 'The task was stopped.';
  });

  // -------------------------------------------------------------- rendering
  const refresh = () => {
    const task = agent.current;
    const isRunning = Boolean(task && task.state === 'running');
    running.classList.toggle('is-active', isRunning);
    runningBeacon.classList.toggle('is-working', isRunning);
    stopButton.disabled = !isRunning;
    if (isRunning && task) {
      runningText.textContent = task.status;
      runningFill.style.setProperty('width', `${task.percent}%`);
    } else {
      runningText.textContent = 'The agent is idle.';
      runningFill.style.setProperty('width', '0%');
    }

    while (taskList.firstChild) taskList.removeChild(taskList.firstChild);
    if (agent.tasks.length === 0) {
      taskList.appendChild(
        h(doc, 'li', { class: 'agent-empty u-body', text: 'No tasks yet — ask for something above.' }),
      );
      return;
    }
    for (const entry of agent.tasks) {
      const item = h(doc, 'li', {
        class: 'agent-task',
        attrs: { 'data-task': entry.id, 'data-state': entry.state },
      });
      const top = h(doc, 'div', { class: 'agent-task-top' });
      top.appendChild(h(doc, 'span', { class: 'agent-task-prompt', text: entry.prompt }));
      top.appendChild(h(doc, 'span', { class: 'agent-task-state u-label', text: entry.state }));
      item.appendChild(top);
      if (entry.attachments.length > 0) {
        const files = h(doc, 'div', { class: 'agent-task-files' });
        for (const attachment of entry.attachments) {
          files.appendChild(
            h(doc, 'span', { class: 'agent-file u-label', text: attachment.name }),
          );
        }
        item.appendChild(files);
      }
      if (entry.result) {
        item.appendChild(h(doc, 'p', { class: 'agent-task-result u-body', text: entry.result }));
      }
      if (entry.error) {
        item.appendChild(h(doc, 'p', { class: 'agent-task-error u-body', text: entry.error }));
      }
      taskList.appendChild(item);
    }
  };

  agent.on('task:start', refresh);
  agent.on('task:progress', refresh);
  agent.on('task:done', refresh);
  agent.on('task:error', refresh);
  agent.on('task:stopped', refresh);
  refresh();

  return {
    id: 'agent',
    title: 'Agent',
    el,
    handleAttachment,
    refresh,
    destroy() {
      offStart();
      offDone();
      offError();
      offStopped();
    },
  };
}
