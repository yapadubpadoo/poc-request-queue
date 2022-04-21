import {RedisClientType} from 'redis';

export default class SessionRequester {
  private sessionChannelName = 'session-request-channel';
  /*
    the session request should finish before queue wait timeout
  */
  private requestSessionTimeoutInSeconds = 30;
  private queueWaitTimeoutInSeconds = 50;
  /* ------------------------------------------ */
  private queues: {
    [key: string]: {
      resolvers: any[];
      // rejecters: any[];
    };
  };
  private cacheClient: RedisClientType;
  private subscriberClient: RedisClientType;
  private publisherClient: RedisClientType;
  constructor(cacheClient: any, subscriberClient: any, publisherClient: any) {
    this.queues = {};
    this.cacheClient = cacheClient;
    this.subscriberClient = subscriberClient;
    this.subscriberClient.subscribe(
      this.sessionChannelName,
      async (message: string, channel: string) => {
        await this.handleSessionMessage(message);
      }
    );
    this.publisherClient = publisherClient;
  }

  public async handleSessionMessage(sessionMessage: string) {
    console.log('[Pub/Sub] Got message +++', sessionMessage);
    const messageData = JSON.parse(sessionMessage);
    const jobs = {...this.queues[`q-${messageData.id}`]};
    delete this.queues[`q-${messageData.id}`];

    console.log(
      `[${messageData.id}] Got new session, resolve with`,
      sessionMessage,
      'and clear queue, now =',
      this.queues[`q-${messageData.id}`]
    );

    await this.save(messageData.id, sessionMessage);
    jobs.resolvers.forEach(resolve => {
      resolve(messageData);
    });
  }

  public async request(id: string) {
    const sessionCache = await this.cacheClient.get(id);
    if (sessionCache !== null) {
      const session = JSON.parse(sessionCache);
      console.log(`[${id}] Existing session found`, session);
      return session;
    }
    await this.requestNewSessionIfNotExist(id);
    return this.queueRequest(id);
  }

  public async requestNewSessionIfNotExist(id: string): Promise<void> {
    const requestKey = `request-${id}`;
    const existingSessionRequest = await this.cacheClient.getSet(
      requestKey,
      'locked'
    );
    await this.cacheClient.expire(
      requestKey,
      this.requestSessionTimeoutInSeconds
    );
    console.log(
      `[${id}] Get existing session request, found "${existingSessionRequest}"`
    );
    if (existingSessionRequest === null) {
      console.log(`[${id}] Request new session`);
      setTimeout(async () => {
        const generatedSession = {
          id: `${id}`,
          session: 'OK',
          createAt: new Date(),
        };
        await this.publisherClient.publish(
          this.sessionChannelName,
          JSON.stringify(generatedSession)
        );
        await this.cacheClient.del(requestKey);
        console.log(
          `[${generatedSession.id}] New session requested, publish`,
          generatedSession
        );
      }, 5000);
    }
  }

  public async queueRequest(id: string) {
    const queueKey = `q-${id}`;
    if (this.queues[queueKey] === undefined) {
      this.queues[queueKey] = {
        resolvers: [],
        // rejecters: [],
      };
    }
    return new Promise((resolve, reject) => {
      this.queues[queueKey].resolvers.push(resolve);
      console.log(
        `[${id}] Request is queued, size = `,
        this.queues[queueKey].resolvers.length
      );
      setTimeout(() => {
        reject(new Error(`[${id}] Timeout waiting for session`));
      }, this.queueWaitTimeoutInSeconds * 1000);
    });
  }

  public async clear(id: string) {
    return this.cacheClient.del(id);
  }

  public async save(id: string, session: string) {
    const sessionTimeoutSeconds = 10;
    return this.cacheClient.setEx(id, sessionTimeoutSeconds, session);
  }
}
