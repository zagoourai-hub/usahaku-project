import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { AppModule, configureApp } from '../src/app.module.js';
import { MailService } from '../src/auth/mail.service.js';
import { SignupLimiter } from '../src/auth/rate-limit.js';

// A real small business: Es Teh Manis, 10 glasses per batch. Expected numbers are
// worked out by hand below in whole rupiah, independent of the app's calculator.
//
//   Teh celup    1 box = 25 kantong, Rp 7.500   -> Rp 300 / kantong   x 5      = Rp 1.500
//   Gula pasir   1 kg, Rp 16.000                -> Rp 16 / g          x 250    = Rp 4.000
//   Es batu      5 kg, Rp 10.000                -> Rp 2 / g           x 2.000  = Rp 4.000
//   Gelas        1 pack = 50 pcs, Rp 12.000     -> Rp 240 / pcs       x 10     = Rp 2.400
//   bahan per resep Rp 11.900  ->  / 10 porsi = Rp 1.190
//   overhead per porsi: gas+listrik 150 + tenaga kerja 500 = Rp 650
//   HPP per porsi = 1.190 + 650 = Rp 1.840
//   target margin 60% (dari harga jual) -> 1.840 / 0,4 = Rp 4.600
describe('HPP Es Teh Manis (e2e)', () => {
  const ORIGIN = 'http://localhost:3000';
  let app: INestApplication;
  let agent: TestAgent;

  beforeAll(async () => {
    if (existsSync('.env')) process.loadEnvFile();
    process.env.FRONTEND_ORIGIN = ORIGIN;
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 1,
          timeToExpire: 0,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      })
      .overrideProvider(SignupLimiter)
      .useValue({ take: async () => undefined, release: async () => undefined })
      .overrideProvider(MailService)
      .useValue({ send: async () => undefined })
      .compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    agent = request.agent(app.getHttpServer()).set('Origin', ORIGIN);
    await agent
      .post('/auth/sign-up/email')
      .send({
        name: 'Pak Budi',
        email: `esteh-${randomUUID()}@test.local`,
        password: 'rahasia123',
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  const ingredient = async (body: object) =>
    (await agent.post('/ingredients').send(body).expect(201)).body as {
      id: string;
      pricePerUsageUnit: string;
    };

  it('computes unit prices, HPP, recommended price and margin like the hand calculation', async () => {
    const teh = await ingredient({
      name: 'Teh Celup',
      purchaseUnit: 'pack',
      purchaseQty: 25,
      usageUnit: 'pcs',
      purchasePrice: 7500,
    });
    const gula = await ingredient({
      name: 'Gula Pasir',
      purchaseUnit: 'kg',
      purchaseQty: 1,
      usageUnit: 'gram',
      purchasePrice: 16000,
    });
    const es = await ingredient({
      name: 'Es Batu',
      purchaseUnit: 'kg',
      purchaseQty: 5,
      usageUnit: 'gram',
      purchasePrice: 10000,
    });
    const gelas = await ingredient({
      name: 'Gelas Plastik',
      purchaseUnit: 'pack',
      purchaseQty: 50,
      usageUnit: 'pcs',
      purchasePrice: 12000,
    });
    expect([teh, gula, es, gelas].map((i) => i.pricePerUsageUnit)).toEqual([
      '300',
      '16',
      '2',
      '240',
    ]);

    const created = await agent
      .post('/recipes')
      .send({
        name: 'Es Teh Manis',
        yieldPortions: 10,
        targetMarginPct: 60,
        sellingPrice: 5000,
        ingredients: [
          { ingredientId: teh.id, quantity: 5 },
          { ingredientId: gula.id, quantity: 250 },
          { ingredientId: es.id, quantity: 2000 },
          { ingredientId: gelas.id, quantity: 10 },
        ],
        overheads: [
          { name: 'Gas dan listrik', costPerPortion: 150 },
          { name: 'Tenaga kerja', costPerPortion: 500 },
        ],
      })
      .expect(201);
    const recipe = (await agent.get(`/recipes/${created.body.id}`).expect(200))
      .body;
    expect(recipe.currentHpp).toBe('1840');
    expect(recipe.recommendedPrice).toBe('4600');
    expect(recipe.sellingPrice).toBe('5000');
    // margin at the real price: (5.000 - 1.840) / 5.000 = 63,2%
    const margin = ((5000 - Number(recipe.currentHpp)) / 5000) * 100;
    expect(margin).toBeCloseTo(63.2, 5);
    expect(recipe.ingredients).toHaveLength(4);

    // sugar goes from Rp 16.000 to Rp 18.000 per kg: +Rp 2 per gram x 250 g / 10 = +Rp 50 per porsi
    await agent
      .patch(`/ingredients/${gula.id}`)
      .send({ purchasePrice: 18000 })
      .expect(200);
    const after = (await agent.get(`/recipes/${created.body.id}`).expect(200))
      .body;
    expect(after.currentHpp).toBe('1890');
    expect(after.recommendedPrice).toBe('4725'); // 1.890 / 0,4
    const history = (
      await agent.get(`/recipes/${created.body.id}/hpp-history`).expect(200)
    ).body as { hppPerPortion: string; trigger: string }[];
    expect(history.map((h) => [h.hppPerPortion, h.trigger])).toEqual([
      ['1840', 'RECIPE_EDIT'],
      ['1890', 'PRICE_CHANGE'],
    ]);
  });
});
