import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildContactShare,
  buildNfmReplyFields,
  buildNfmReplyInteractive,
  extractLastFlowSend,
  parseInteractivePayload
} from './structuredMessage';

test('rejects unknown interactive types', () => {
  const result = parseInteractivePayload({ type: 'button', body: { text: 'hi' } });
  assert.ok('error' in result);
});

test('still accepts location_request_message', () => {
  const result = parseInteractivePayload({
    type: 'location_request_message',
    body: { text: 'Share your pin' }
  });
  assert.ok(!('error' in result));
  if ('error' in result) return;
  assert.equal(result.payload.type, 'location_request_message');
  assert.equal(result.payload.action?.name, 'send_location');
});

test('still accepts request_contact_info', () => {
  const result = parseInteractivePayload({
    type: 'request_contact_info',
    body: { text: 'Share your phone' },
    action: { name: 'request_contact_info' }
  });
  assert.ok(!('error' in result));
});

test('accepts flow interactive and persists the full payload', () => {
  const interactive = {
    type: 'flow',
    header: { type: 'text', text: 'Checkout' },
    body: { text: 'Complete your order details' },
    footer: { text: 'Powered by ordr' },
    action: {
      name: 'flow',
      parameters: {
        flow_message_version: '3',
        flow_id: 'flow-123',
        flow_token: 'real-token-from-ordr',
        flow_cta: 'Continue',
        flow_action: 'data_exchange'
      }
    }
  };
  const result = parseInteractivePayload(interactive);
  assert.ok(!('error' in result));
  if ('error' in result) return;
  assert.equal(result.payload.type, 'flow');
  assert.equal(result.payload.header?.text, 'Checkout');
  assert.equal(result.payload.footer?.text, 'Powered by ordr');
  assert.equal(result.payload.action?.parameters?.flow_token, 'real-token-from-ordr');
  assert.equal(result.payload.action?.parameters?.flow_id, 'flow-123');
  assert.equal(result.payload.action?.parameters?.flow_cta, 'Continue');
  assert.equal(result.bodyText, 'Complete your order details');
});

test('flow requires flow_id and flow_token', () => {
  const missingToken = parseInteractivePayload({
    type: 'flow',
    body: { text: 'hi' },
    action: { name: 'flow', parameters: { flow_id: 'x' } }
  });
  assert.ok('error' in missingToken);

  const missingId = parseInteractivePayload({
    type: 'flow',
    body: { text: 'hi' },
    action: { name: 'flow', parameters: { flow_token: 't' } }
  });
  assert.ok('error' in missingId);
});

test('flow defaults CTA when omitted', () => {
  const result = parseInteractivePayload({
    type: 'flow',
    action: {
      name: 'flow',
      parameters: { flow_id: 'id', flow_token: 'tok' }
    }
  });
  assert.ok(!('error' in result));
  if ('error' in result) return;
  assert.equal(result.payload.action?.parameters?.flow_cta, 'Complete details');
});

test('extractLastFlowSend stores token from persisted payload', () => {
  const parsed = parseInteractivePayload({
    type: 'flow',
    action: { parameters: { flow_id: 'fid', flow_token: 'ftok' } }
  });
  assert.ok(!('error' in parsed));
  if ('error' in parsed) return;
  const last = extractLastFlowSend('interactive', JSON.stringify(parsed.payload), 'wamid.abc');
  assert.deepEqual(last, { flow_id: 'fid', flow_token: 'ftok', wamid: 'wamid.abc' });
});

test('extractLastFlowSend keeps flow_action_payload.data for the UI', () => {
  const parsed = parseInteractivePayload({
    type: 'flow',
    action: {
      parameters: {
        flow_id: 'fid',
        flow_token: 'ftok',
        flow_action_payload: {
          screen: 'DETAILS',
          data: {
            fulfillment_methods: [{ id: 'pickup', title: 'Pickup' }],
            payments_pickup: [{ id: 'CASH', title: 'Cash' }]
          }
        }
      }
    }
  });
  assert.ok(!('error' in parsed));
  if ('error' in parsed) return;
  const last = extractLastFlowSend('interactive', JSON.stringify(parsed.payload), 'wamid.abc');
  assert.equal(last?.screen_data?.fulfillment_methods?.[0]?.id, 'pickup');
  assert.equal(last?.screen_data?.payments_pickup?.[0]?.id, 'CASH');
});

test('nfm_reply blanks unused fields and stringifies response_json', () => {
  const delivery = buildNfmReplyFields('tok-1', {
    customer_name: 'Ada',
    fulfillment: 'delivery',
    payment_option_code: 'pay_1',
    area: 'Center',
    street: 'Main',
    store_id: 'should-be-cleared'
  });
  assert.equal(delivery.flow_token, 'tok-1');
  assert.equal(delivery.store_id, '');
  assert.equal(delivery.area, 'Center');
  assert.equal(delivery.street, 'Main');

  const pickup = buildNfmReplyFields('tok-1', {
    fulfillment: 'pickup',
    store_id: 'store-9',
    area: 'should-be-cleared'
  });
  assert.equal(pickup.fulfillment, 'pickup');
  assert.equal(pickup.store_id, 'store-9');
  assert.equal(pickup.area, '');

  const interactive = buildNfmReplyInteractive(delivery);
  assert.equal(interactive.type, 'nfm_reply');
  assert.equal(typeof interactive.nfm_reply?.response_json, 'string');
  const parsed = JSON.parse(interactive.nfm_reply!.response_json!);
  assert.equal(parsed.flow_token, 'tok-1');
  assert.equal(parsed.customer_name, 'Ada');
});

test('contact share uses a real phone when the chat identity is a BSUID', () => {
  const contacts = buildContactShare('EG.JoeTestBSUID', 'EG.JoeTestBSUID');
  const phone = contacts[0].phones?.[0];
  assert.ok(phone);
  assert.match(phone.wa_id || '', /^2010\d{8}$/);
  assert.equal(phone.phone, `+${phone.wa_id}`);
  assert.equal(contacts[0].origin, 'contact_request');
});

test('contact share keeps a numeric WhatsApp identity', () => {
  const contacts = buildContactShare('Ahmed', '201001234567');
  assert.equal(contacts[0].phones?.[0]?.wa_id, '201001234567');
});

test('contact share override wins for a BSUID chat', () => {
  const contacts = buildContactShare('EG.JoeTestBSUID', 'EG.JoeTestBSUID', 'contact_request', '201120866365');
  assert.equal(contacts[0].phones?.[0]?.wa_id, '201120866365');
});
