import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');

  // Click on mvnv study
  await page.getByRole('button', { name: 'MVNV Study Replication' }).click();

  // Check for introduction page
  const introText = await page.getByText('Welcome to our study. This is a more complex example to show how to embed HTML');
  await expect(introText).toBeVisible();

  // Click on next button
  await page.getByRole('button', { name: 'Next' }).click();

  // Check for consent page
  const consentText = await page.getByRole('heading', { name: 'Consent' });
  await expect(consentText).toBeVisible();

  // Fill in consent form
  await page.getByPlaceholder('Please provide your signature').fill('test');
  await page.getByLabel('Accept').check();

  // Click on next button
  await page.getByRole('button', { name: 'Agree' }).click();

  // Check training page
  const trianingText = await page.frameLocator('#root iframe').getByRole('heading', { name: 'Adjacency Matrix Training' });
  await expect(trianingText).toBeVisible();
  const trainingVideo = await page.frameLocator('#root iframe').locator('video');
  await expect(trainingVideo).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // Check trial tasks
  const q1Text = await page.getByText('Task:Question: Find the North American with the most Tweets');
  await expect(q1Text).toBeVisible();
  await page.frameLocator('#root iframe').locator('#answerBox318046158 rect').click();
  const q1ans = await page.getByText('Krist Wongsuphasawat');
  await expect(q1ans).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  const q2Text = await page.getByText('Task:Question: Find the European person or institution with the least likes');
  await expect(q2Text).toBeVisible();
  await page.getByText('Selected name(s) will show here').click();
  await page.frameLocator('#root iframe').locator('#answerBox136400506 rect').click();
  const q2ans = await page.getByText('Matthew Conlen');
  await expect(q2ans).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  const q3Text = await page.getByText('Task:Question: Which person has many interactions (edges) in this network, sever');
  await expect(q3Text).toBeVisible();
  await page.frameLocator('#root iframe').locator('#answerBox21084111 rect').click();
  const q3ans = await page.getByText('Jan Willem Tulp');
  await expect(q3ans).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  const q4Text = await page.getByText('Task:Question: Find all of Lane\'s European Neighbors');
  await expect(q4Text).toBeVisible();
  await page.frameLocator('#root iframe').locator('#answerBox43953969 rect').click();
  await page.frameLocator('#root iframe').locator('#answerBox188046229 rect').click();
  const q4ans1 = await page.getByText('Jo Wood');
  const q4ans2 = await page.getByText('Benjamin Bach');
  await expect(q4ans1).toBeVisible();
  await expect(q4ans2).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  const q5Text = await page.getByText('Task:Question: Find all of giCentre\'s North American Neighbors');
  await expect(q5Text).toBeVisible();
  await page.frameLocator('#root iframe').locator('#answerBox2873695769 rect').click();
  const q5ans = await page.getByText('Roeland Scheepens');
  await expect(q5ans).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  const q6Text = await page.getByText('Task:Question: Who had the most mention interactions with Jeffrey?');
  await expect(q6Text).toBeVisible();
  await page.frameLocator('#root iframe').locator('#answerBox191257554 rect').click();
  await page.frameLocator('#root iframe').locator('#answerBox909697437694087200 rect').click();
  const q6ans1 = await page.getByText('Eamonn Maguire');
  const q6ans2 = await page.getByText('EuroVis2018');
  await expect(q6ans1).toBeVisible();
  await expect(q6ans2).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  const q7Text = await page.getByText('Task:Question: Does Alex have more mention interactions with North American or E');
  await expect(q7Text).toBeVisible();
  await page.getByLabel('European').check();
  await page.frameLocator('#root iframe').locator('#answerBox4058687172 rect').click();
  const q7ans = await page.getByText('Rina');
  await expect(q7ans).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  const q8Text = await page.getByText('Task:Among all people who have interacted with both Jeffrey and Robert, who has the most followers?');
  await expect(q8Text).toBeVisible();
  await page.getByText('Task:Among all people who have interacted with both Jeffrey and Robert, who has ').click();
  await page.frameLocator('#root iframe').locator('#answerBox247943631 rect').click();
  const q8ans = await page.getByText('Jeffrey Heer');
  await expect(q8ans).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  const q9Text = await page.getByText('Task:Question: What is the most common form of interaction between Evis19 and Jo');
  await expect(q9Text).toBeVisible();
  await page.getByLabel('Mentions').check();
  await page.getByPlaceholder('answer text').fill('test');
  await page.getByRole('button', { name: 'Next' }).click();

  const q10Text = await page.getByText('Task:Question: Select all of Noeska’s neighbors that are people and have more fr');
  await expect(q10Text).toBeVisible();
  await page.frameLocator('#root iframe').locator('#answerBox16557883 rect').click();
  await page.frameLocator('#root iframe').locator('#answerBox82890309 rect').click();
  const q10ans1 = await page.getByText('Nils Gehlenborg');
  const q10ans2 = await page.getByText('Dominik Moritz');
  await expect(q10ans1).toBeVisible();
  await expect(q10ans2).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  const q11Text = await page.getByText('Task:Question: Select the people who have interacted with Thomas and have more friends than followers');
  await expect(q11Text).toBeVisible();
  await page.frameLocator('#root iframe').locator('#answerBox18406335 rect').click();
  await page.frameLocator('#root iframe').locator('#answerBox191257554 rect').click();
  const q11ans1 = await page.getByText('Papadopoulos Teo');
  const q11ans2 = await page.getByText('Eamonn Maguire');
  await expect(q11ans1).toBeVisible();
  await expect(q11ans2).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  const q12Text = await page.getByText('Task:Question: Select the people who have interacted with Thomas and have more friends than followers');
  await expect(q12Text).toBeVisible(); 
  await page.frameLocator('#root iframe').locator('#answerBox2527017636 rect').click();
  const q12ans = await page.getByText('Thomas Höllt');
  await expect(q12ans).toBeVisible();
  await page.getByPlaceholder('answer text').fill('test');
  await page.getByRole('button', { name: 'Next' }).click();

  const q13Text = await page.getByText('Task:Question: What is the institution on a shortest path between Lane and Rob. What is its continent of origin?');
  await expect(q13Text).toBeVisible();
  await page.frameLocator('#root iframe').locator('#answerBox188046229 rect').click();
  await page.getByLabel('NA').check();
  await page.frameLocator('#root iframe').locator('#answerBox29700681 rect').click();
  const q13ans1 = await page.getByText('Benjamin Bach');
  const q13ans2 = await page.getByText('Bum Chul Kwon');
  await expect(q13ans1).toBeVisible();
  await expect(q13ans2).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  const q14Text = await page.getByText('Task:Question: What is the institution on a shortest path between Jason and Jon. What is its continent of origin?');
  await expect(q14Text).toBeVisible();
  await page.frameLocator('#root iframe').locator('#answerBox227831457 rect').click();
  await page.frameLocator('#root iframe').locator('#answerBox2873695769 rect').click();
  await page.getByLabel('NA').check();
  await page.frameLocator('#root iframe').locator('#answerBox2873695769 rect').click();
  const q14ans = await page.getByText('Sophie Engle');
  await expect(q14ans).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  const q15Text = await page.getByText('Task:Question: Of the North Americans who are two interactions away from Sereno,');
  await expect(q15Text).toBeVisible();
  await page.frameLocator('#root iframe').locator('#answerBox270431596 rect').click();
  const q15ans = await page.getByText('Klaus');
  await page.getByRole('button', { name: 'Next' }).click();

  const q16Text = await page.getByText('Task:Question: Please explore the network freely and report on your findings. Is');
  await expect(q16Text).toBeVisible();
  await page.getByLabel('Enter Findings Below *').fill('Blah Blah Blah');
  await page.getByRole('button', { name: 'Next' }).click();

  // Check that the thank you message is displayed
  await page.getByText('Thank you for completing the study. You may close this window now.').click();
});
