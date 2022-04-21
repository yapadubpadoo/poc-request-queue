import * as Koa from 'koa';
import * as Router from '@koa/router';

import {createClient} from 'redis';
import SessionRequester from './session-requester';

(async () => {
  const cacheClient = createClient();
  cacheClient.on('error', err => console.log('Redis Client Error', err));
  await cacheClient.connect();

  const subscriberClient = createClient();
  subscriberClient.on('error', err => console.log('Redis Client Error', err));
  await subscriberClient.connect();

  const publisherClient = createClient();
  publisherClient.on('error', err => console.log('Redis Client Error', err));
  await publisherClient.connect();

  const sessionRequester = new SessionRequester(
    cacheClient,
    subscriberClient,
    publisherClient
  );

  const app = new Koa();
  const router = new Router();

  router.get('/', async (ctx, next) => {
    const getRandomInt = (max: number) => {
      return Math.floor(Math.random() * max);
    };
    const randomID = getRandomInt(4);
    const session = await sessionRequester.request(`fid-${randomID}`);
    ctx.body = {hello: 'world', session};
  });

  app.use(async (ctx, next) => {
    try {
      return next();
    } catch (error) {
      const err = error as Error;
      ctx.status = 500;
      ctx.body = {
        message: err.message,
      };
    }
  });
  app.use(router.routes()).use(router.allowedMethods());
  app.listen(3001);
})();
