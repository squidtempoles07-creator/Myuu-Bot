import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const SUMMARY_COMMAND = {
  name: 'summary',
  description: 'Generate an AI summary of a Discord channel',
  options: [
    {
      type: 7,
      name: 'channel',
      description: 'The channel to summarize',
      required: true,
      channel_types: [0, 5],
    },
    {
      type: 3,
      name: 'start_date',
      description: 'Start date (YYYY-MM-DD)',
      required: true,
    },
    {
      type: 3,
      name: 'end_date',
      description: 'End date (YYYY-MM-DD)',
      required: true,
    },
    {
      type: 3,
      name: 'language',
      description: 'Summary language',
      required: false,
      choices: [
        { name: 'English', value: 'English' },
        { name: 'Indonesian', value: 'Indonesian' },
      ],
    },
  ],
  type: 1,
  integration_types: [0],
  contexts: [0],
};

const ALL_COMMANDS = [TEST_COMMAND, SUMMARY_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
