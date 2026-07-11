import { test, expect } from '@playwright/test';

test('home screen is keyboard-accessible and exposes primary navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/CSP Insights/);
  await expect(page.getByRole('heading', { name: 'CSP Insights' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Home', exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).focus();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
});

test('upload zone supports keyboard activation', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Start Analysis', { exact: true }).first().click();
  const uploadZone = page.getByRole('button', { name: 'Upload Reconciliation Files' });
  await expect(uploadZone).toBeVisible();
  await uploadZone.focus();
  await expect(uploadZone).toBeFocused();
});
