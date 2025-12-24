import { expect, type Page } from '@playwright/test';
import { ensureMockApi } from './mockServer';

/**
 * Page objects for common quiz app flows used across user-story tests.
 */

export class JoinPage {
  constructor(private readonly page: Page) {}

  async openWithCode(joinCode: string): Promise<void> {
    await ensureMockApi(this.page);
    await this.page.goto(`/join?code=${joinCode}`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(300);
  }

  async fillDisplayName(name: string): Promise<void> {
    const nameInput = this.page.getByLabel(/Display Name|Name|Your Name/i).or(this.page.locator('input[type="text"]').first());
    await nameInput.fill(name);
  }

  async selectEmojiAvatar(): Promise<void> {
    const emojiButton = this.page
      .locator('button')
      .filter({ hasText: /^😀$/ })
      .first();

    if (await emojiButton.count()) {
      await emojiButton.click();
      await this.page.waitForTimeout(200);
      return;
    }

    const buttons = this.page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i += 1) {
      const candidate = buttons.nth(i);
      const text = (await candidate.textContent())?.trim();
      if (text && text.length === 1 && !/[A-Za-z0-9]/.test(text)) {
        await candidate.click();
        await this.page.waitForTimeout(200);
        break;
      }
    }
  }

  async submitJoin(): Promise<void> {
    const joinButton = this.page.getByRole('button', { name: /Join Event|Join|Enter|Continue/i }).first();
    await joinButton.waitFor({ state: 'visible', timeout: 5000 });
    await Promise.all([
      this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}),
      joinButton.click(),
    ]);
  }

  async joinWithCodeAndName(joinCode: string, name: string): Promise<void> {
    await ensureMockApi(this.page);
    await this.openWithCode(joinCode);
    await this.fillDisplayName(name);
    await this.selectEmojiAvatar();
    await this.submitJoin();
  }
}

export class PresenterDashboard {
  constructor(private readonly page: Page) {}

  async lockJoining(): Promise<void> {
    const lockButton = this.page.getByRole('button', { name: /Lock QR|Lock Join|Lock Entry|Lock/i });
    if (await lockButton.count()) {
      await lockButton.first().click();
    }
  }

  async unlockJoining(): Promise<void> {
    const unlockButton = this.page.getByRole('button', { name: /Unlock QR|Unlock Join|Unlock Entry|Unlock/i });
    if (await unlockButton.count()) {
      await unlockButton.first().click();
    }
  }

  async startQuiz(): Promise<void> {
    const startButton = this.page.getByRole('button', { name: /Start Quiz|Start Segment|Start/i });
    if (await startButton.count()) {
      await startButton.first().click();
    }
  }

  async resumeSegment(): Promise<void> {
    const resumeButton = this.page.getByRole('button', { name: /Resume Segment|Resume Event|Resume/i });
    if (await resumeButton.count()) {
      await resumeButton.first().click();
    }
  }

  async passPresenter(targetName: string): Promise<void> {
    const passButton = this.page.getByRole('button', { name: /Pass Presenter|Next Presenter|Pass/i });
    if (await passButton.count()) {
      await passButton.first().click();
      const targetOption = this.page.getByText(targetName, { exact: false }).first();
      if (await targetOption.count()) {
        await targetOption.click();
      }
    }
  }

  async openExport(): Promise<void> {
    const exportButton = this.page.getByRole('button', { name: /Export|Download/i });
    if (await exportButton.count()) {
      await exportButton.first().click();
    }
  }
}

export class ParticipantView {
  constructor(private readonly page: Page) {}

  async waitForStatus(text: RegExp | string): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible({ timeout: 10000 });
  }

  async answerFirstOption(): Promise<void> {
    const option = this.page.getByRole('button').filter({ hasText: /A|B|C|D|Option|Answer/i }).first();
    if (await option.count()) {
      await option.click();
    }
  }
}

export class LeaderboardPage {
  constructor(private readonly page: Page) {}

  async expectPlayer(name: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(name, 'i'))).toBeVisible({ timeout: 10000 });
  }
}

export class ExportPage {
  constructor(private readonly page: Page) {}

  async chooseFormat(format: 'json' | 'csv'): Promise<void> {
    const formatButton = this.page.getByRole('button', { name: new RegExp(format, 'i') }).first();
    if (await formatButton.count()) {
      await formatButton.click();
    }
  }

  async startDownload(): Promise<void> {
    const downloadButton = this.page.getByRole('button', { name: /Download|Export/i }).first();
    await downloadButton.click();
  }
}

