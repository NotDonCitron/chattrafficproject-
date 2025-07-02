/**
 * Utility-Funktion zum automatischen Ausfüllen des Thundr.com Anmeldeformulars
 * Diese Funktion erkennt und füllt das Formular aus, sobald es erscheint
 */

class ThundrFormFiller {
  constructor(config = {}) {
    this.config = {
      profile: {
        gender: config.gender || 'Female',
        lookingFor: config.lookingFor || 'Men',
        ageGroup: config.ageGroup || 'Everyone',
        birthDate: config.birthDate || {
          day: '12',
          month: '08', 
          year: '2002'
        }
      },
      delays: {
        min: config.minDelay || 500,
        max: config.maxDelay || 1500
      }
    };
  }

  async randomDelay(min = this.config.delays.min, max = this.config.delays.max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async isFormVisible(page) {
    const formIndicators = [
      'input[placeholder="MM"]',
      'input[placeholder="DD"]', 
      'input[placeholder="YYYY"]',
      'text=Female',
      'text=Male',
      'button:has-text("Start")'
    ];

    for (const indicator of formIndicators) {
      try {
        const element = await page.$(indicator);
        if (element && await element.isVisible()) {
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    return false;
  }

  async fillForm(page) {
    try {
      console.log('📝 Starte automatisches Ausfüllen des Thundr-Formulars...');

      // 1. "I Agree" klicken, falls sichtbar
      const agreeBtn = await page.$('button:has-text("I Agree")');
      if (agreeBtn && await agreeBtn.isVisible()) {
        await agreeBtn.click();
        console.log('✅ "I Agree" geklickt');
        await this.randomDelay();
      }

      if (!await this.isFormVisible(page)) {
        console.log('ℹ️ Formular nicht sichtbar, überspringe...');
        return false;
      }

      await this.randomDelay(1000, 2000);

      // ... Rest wie gehabt (Gender, LookingFor, AgeGroup, BirthDate, Checkbox, Start)
      // (Hier kommt der bisherige Code für das Ausfüllen des Formulars)
    } catch (error) {
      console.error('❌ Fehler beim Ausfüllen des Formulars:', error);
      return false;
    }
  }
}

module.exports = {
  ThundrFormFiller,
  async fillThundrForm(page, config = {}) {
    const formFiller = new ThundrFormFiller(config);
    return await formFiller.fillForm(page);
  }
}; 