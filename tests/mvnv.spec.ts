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

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = await page.url();
    if (url.includes('end')) {
      break;
    }

    const qText = await page.getByText('Task:Question:');
    await expect(qText).toBeVisible();

    if (url.includes('task0')) {
      await page.getByText('Selected name(s) will show here').click();
      await page.frameLocator('#root iframe').locator('#answerBox318046158 rect').click();
      const q0ans = await page.getByText('Krist Wongsuphasawat');
      await expect(q0ans).toBeVisible();
    }
    
    if (url.slice(-2) === 'k1') {
      await page.frameLocator('#root iframe').locator('#answerBox318046158 rect').click();
      const q1ans = await page.getByText('Krist Wongsuphasawat');
      await expect(q1ans).toBeVisible();
    }

    if (url.includes('task2')) {
      await page.getByText('Selected name(s) will show here').click();
      await page.frameLocator('#root iframe').locator('#answerBox136400506 rect').click();
      const q2ans = await page.getByText('Matthew Conlen');
      await expect(q2ans).toBeVisible();
    }

    if (url.includes('task3')) {
      await page.frameLocator('#root iframe').locator('#answerBox21084111 rect').click();
      const q3ans = await page.getByText('Jan Willem Tulp');
      await expect(q3ans).toBeVisible();
    }

    if (url.includes('task4')) {
      await page.frameLocator('#root iframe').locator('#answerBox43953969 rect').click();
      await page.frameLocator('#root iframe').locator('#answerBox188046229 rect').click();
      const q4ans1 = await page.getByText('Jo Wood');
      const q4ans2 = await page.getByText('Benjamin Bach');
      await expect(q4ans1).toBeVisible();
      await expect(q4ans2).toBeVisible();
    }

    if (url.includes('task5')) {
      await page.frameLocator('#root iframe').locator('#answerBox2873695769 rect').click();
      const q5ans = await page.getByText('Roeland Scheepens');
      await expect(q5ans).toBeVisible();
    }

    if (url.includes('task7')) {
      await page.frameLocator('#root iframe').locator('#answerBox191257554 rect').click();
      await page.frameLocator('#root iframe').locator('#answerBox909697437694087200 rect').click();
      const q6ans1 = await page.getByText('Eamonn Maguire');
      const q6ans2 = await page.getByText('EuroVis2018');
      await expect(q6ans1).toBeVisible();
      await expect(q6ans2).toBeVisible();
    }

    if (url.includes('task6')) {
      await page.getByLabel('European').check();
      await page.frameLocator('#root iframe').locator('#answerBox4058687172 rect').click();
      const q7ans = await page.getByText('Rina');
      await expect(q7ans).toBeVisible();
    }

    if (url.includes('task9')) {
      await page.frameLocator('#root iframe').locator('#answerBox247943631 rect').click();
      const q8ans = await page.getByText('Jeffrey Heer');
      await expect(q8ans).toBeVisible();
    }

    if (url.includes('task8')) {
      await page.getByLabel('Mentions').check();
      await page.getByPlaceholder('answer text').fill('test');
    }

    if (url.includes('task10')) {
      await page.frameLocator('#root iframe').locator('#answerBox247943631 rect').click();
      await page.frameLocator('#root iframe').locator('#answerBox92951551 rect').click();
      const q10ans1 = await page.getByText('Jeffrey Heer');
      const q10ans2 = await page.getByText('Nicola Pezzotti');
      await expect(q10ans1).toBeVisible();
      await expect(q10ans2).toBeVisible();
    }

    if (url.includes('task11')) {
      await page.frameLocator('#root iframe').locator('#answerBox18406335 rect').click();
      await page.frameLocator('#root iframe').locator('#answerBox191257554 rect').click();
      const q11ans1 = await page.getByText('Papadopoulos Teo');
      const q11ans2 = await page.getByText('Eamonn Maguire');
      await page.getByPlaceholder('answer text').fill('test');
      await expect(q11ans1).toBeVisible();
      await expect(q11ans2).toBeVisible();
    }

    if (url.includes('task14')) {
      await page.frameLocator('#root iframe').locator('#answerBox2527017636 rect').click();
      const q12ans = await page.getByText('Thomas Höllt');
      await expect(q12ans).toBeVisible();
    }

    if (url.includes('task12')) {
      await page.frameLocator('#root iframe').locator('#answerBox188046229 rect').click();
      await page.getByLabel('NA').check();
      await page.frameLocator('#root iframe').locator('#answerBox29700681 rect').click();
      const q13ans1 = await page.getByText('Benjamin Bach');
      const q13ans2 = await page.getByText('Bum Chul Kwon');
      await expect(q13ans1).toBeVisible();
      await expect(q13ans2).toBeVisible();
    }

    if (url.includes('task13')) {
      await page.frameLocator('#root iframe').locator('#answerBox227831457 rect').click();
      await page.frameLocator('#root iframe').locator('#answerBox2873695769 rect').click();
      await page.getByLabel('NA').check();
      await page.frameLocator('#root iframe').locator('#answerBox2873695769 rect').click();
      const q14ans = await page.getByText('Sophie Engle');
      await expect(q14ans).toBeVisible();
    }

    if (url.includes('task15')) {
      await page.getByLabel('Enter Findings Below *').fill('Blah Blah Blah');
    }

    await page.getByRole('button', { name: 'Next' }).click();
  }

  // Check that the thank you message is displayed
  await page.getByText('Thank you for completing the study. You may close this window now.').click();
});
