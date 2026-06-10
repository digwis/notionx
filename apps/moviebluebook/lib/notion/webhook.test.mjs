import test from "node:test";
import assert from "node:assert/strict";
import {
  getStoredNotionWebhookVerificationToken,
  notionWebhookEventToRevalidateRequest,
  parseNotionWebhookPayload,
  parseNotionWebhookPayloadWithPageLookup,
  putStoredNotionWebhookVerificationToken,
  signNotionWebhookBody,
  verifyNotionWebhookSignature,
  verifyNotionWebhookSignatureWithTokens,
} from "./webhook.ts";

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test("parseNotionWebhookPayload accepts verification handshake", () => {
  assert.deepEqual(
    parseNotionWebhookPayload({ verification_token: "verify-me" }),
    {
      type: "verification",
      verificationToken: "verify-me",
    }
  );
});

test("verifyNotionWebhookSignature validates HMAC signature", async () => {
  const body = JSON.stringify({ events: [] });
  const signature = await signNotionWebhookBody(body, "verify-me");

  assert.equal(
    await verifyNotionWebhookSignature({
      body,
      signature,
      verificationToken: "verify-me",
    }),
    true
  );
  assert.equal(
    await verifyNotionWebhookSignature({
      body,
      signature: `sha256=${signature}`,
      verificationToken: "verify-me",
    }),
    true
  );
  assert.equal(
    await verifyNotionWebhookSignature({
      body,
      signature,
      verificationToken: "wrong",
    }),
    false
  );
});

test("stored Notion webhook verification token can validate future events", async () => {
  const values = new Map();
  const cache = {
    kind: "external",
    async get(key) {
      return values.get(key) ?? null;
    },
    async put(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    },
    async list() {
      return { keys: [], listComplete: true };
    },
  };

  assert.equal(
    await putStoredNotionWebhookVerificationToken(cache, "stored-token"),
    true
  );
  assert.equal(
    await getStoredNotionWebhookVerificationToken(cache),
    "stored-token"
  );

  const body = JSON.stringify({ events: [{ type: "page.content_updated" }] });
  const signature = await signNotionWebhookBody(body, "stored-token");
  assert.equal(
    await verifyNotionWebhookSignatureWithTokens({
      body,
      signature: `sha256=${signature}`,
      verificationTokens: [undefined, "stored-token"],
    }),
    true
  );
});

test("parseNotionWebhookPayload maps data source events to list-only revalidation", () => {
  const previous = process.env.NOTION_DATA_SOURCE_ID;
  process.env.NOTION_DATA_SOURCE_ID = "data-source-1";

  try {
    const parsed = parseNotionWebhookPayload({
      events: [
        {
          id: "event-1",
          type: "data_source.content_updated",
          entity: { type: "data_source", id: "data-source-1" },
        },
      ],
    });

    assert.equal(parsed.type, "events");
    assert.deepEqual(parsed.events, [
      {
        id: "event-1",
        eventType: "data_source.content_updated",
        modelId: "blog",
        pageId: undefined,
        dataSourceId: "data-source-1",
        routeId: undefined,
        locale: undefined,
        kind: "update",
        includeApi: true,
        reason: "data_source",
      },
    ]);
    assert.deepEqual(
      notionWebhookEventToRevalidateRequest(parsed.events[0]),
      {
        modelId: "blog",
        pageId: undefined,
        routeId: undefined,
        locale: undefined,
        kind: "update",
        includeApi: true,
      }
    );
  } finally {
    restoreEnv("NOTION_DATA_SOURCE_ID", previous);
  }
});

test("parseNotionWebhookPayloadWithPageLookup fetches page properties for official page events", async () => {
  const previous = process.env.NOTION_DATA_SOURCE_ID;
  process.env.NOTION_DATA_SOURCE_ID = "data-source-1";

  try {
    const parsed = await parseNotionWebhookPayloadWithPageLookup(
      {
        events: [
          {
            id: "event-lookup",
            type: "page.properties_updated",
            entity: { type: "page", id: "page-lookup" },
            data: {
              parent: {
                id: "parent-id",
                data_source_id: "data-source-1",
              },
              updated_properties: ["Slug"],
            },
          },
        ],
      },
      {
        retrievePage: async (pageId, model) => {
          assert.equal(pageId, "page-lookup");
          assert.equal(model.id, "blog");
          return {
            id: pageId,
            properties: {
              Slug: {
                type: "rich_text",
                rich_text: [{ plain_text: "looked-up-soup" }],
              },
            },
          };
        },
      }
    );

    assert.equal(parsed.type, "events");
    assert.equal(parsed.events[0].modelId, "blog");
    assert.equal(parsed.events[0].pageId, "page-lookup");
    assert.equal(parsed.events[0].dataSourceId, "data-source-1");
    assert.equal(parsed.events[0].routeId, "looked-up-soup");
    assert.equal(parsed.events[0].kind, "update");
  } finally {
    restoreEnv("NOTION_DATA_SOURCE_ID", previous);
  }
});

test("parseNotionWebhookPayloadWithPageLookup can defer page lookup until after signature verification", async () => {
  const previous = process.env.NOTION_DATA_SOURCE_ID;
  process.env.NOTION_DATA_SOURCE_ID = "data-source-1";

  try {
    const parsed = await parseNotionWebhookPayloadWithPageLookup(
      {
        events: [
          {
            id: "event-deferred",
            type: "page.properties_updated",
            entity: { type: "page", id: "page-deferred" },
            data: {
              parent: {
                data_source_id: "data-source-1",
              },
            },
          },
        ],
      },
      {
        lookupPages: false,
        retrievePage: async () => {
          throw new Error("lookup should be deferred");
        },
      }
    );

    assert.equal(parsed.type, "events");
    assert.equal(parsed.events[0].modelId, "blog");
    assert.equal(parsed.events[0].pageId, "page-deferred");
    assert.equal(parsed.events[0].routeId, undefined);
  } finally {
    restoreEnv("NOTION_DATA_SOURCE_ID", previous);
  }
});

test("parseNotionWebhookPayload maps page events with slugs to detail revalidation", () => {
  const previous = process.env.NOTION_DATA_SOURCE_ID;
  process.env.NOTION_DATA_SOURCE_ID = "data-source-1";

  try {
    const parsed = parseNotionWebhookPayload({
      events: [
        {
          id: "event-2",
          type: "page.properties_updated",
          entity: { type: "page", id: "page-1" },
          data: {
            page: {
              object: "page",
              id: "page-1",
              parent: { type: "data_source_id", data_source_id: "data-source-1" },
              properties: {
                Slug: {
                  type: "rich_text",
                  rich_text: [{ plain_text: "summer-soup" }],
                },
              },
            },
          },
        },
      ],
    });

    assert.equal(parsed.type, "events");
    assert.equal(parsed.events[0].modelId, "blog");
    assert.equal(parsed.events[0].pageId, "page-1");
    assert.equal(parsed.events[0].dataSourceId, "data-source-1");
    assert.equal(parsed.events[0].routeId, "summer-soup");
    assert.equal(parsed.events[0].kind, "update");
  } finally {
    restoreEnv("NOTION_DATA_SOURCE_ID", previous);
  }
});

test("parseNotionWebhookPayload maps movie page ids to compact route ids", () => {
  const previous = process.env.NOTION_MOVIES_DATA_SOURCE_ID;
  process.env.NOTION_MOVIES_DATA_SOURCE_ID = "movie-source";

  try {
    const parsed = parseNotionWebhookPayload({
      events: [
        {
          id: "event-3",
          type: "page.deleted",
          entity: { type: "page", id: "371dc62d-0738-8025-b7dd-f33519a7f2f8" },
          data: {
            page: {
              object: "page",
              id: "371dc62d-0738-8025-b7dd-f33519a7f2f8",
              parent: { type: "data_source_id", data_source_id: "movie-source" },
            },
          },
        },
      ],
    });

    assert.equal(parsed.type, "events");
    assert.equal(parsed.events[0].modelId, "movies");
    assert.equal(
      parsed.events[0].pageId,
      "371dc62d-0738-8025-b7dd-f33519a7f2f8"
    );
    assert.equal(parsed.events[0].dataSourceId, "movie-source");
    assert.equal(
      parsed.events[0].routeId,
      "371dc62d07388025b7ddf33519a7f2f8"
    );
    assert.equal(parsed.events[0].kind, "delete");
  } finally {
    restoreEnv("NOTION_MOVIES_DATA_SOURCE_ID", previous);
  }
});
