/* Physical-store workflows. All writes use the same authorized backend as the online portal. */
(function () {
  'use strict';
  const D = window.PNC_DB;
  const $ = s => document.querySelector(s);
  const esc = D.esc;
  const token = () => 'store-' + (window.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2));
  let lines = [{productId: '', label: '', amount: '', qty: 1}];
  let requestId = token();
  let busy = false;
  const saved = () => window.dispatchEvent(new CustomEvent("pnc:store-saved"));
  const option = (id, name) => '<option value="' + esc(id) + '">' + esc(name) + '</option>';
  const methods = '<option>Cash</option><option>Bank transfer</option>';
  function renderPOS() {
    const select = $('#posOwner');
    const selected = select.value;
    select.innerHTML = option('', 'Walk-in customer — no account required') + D.db.owners.map(o => option(o.id, o.fullName + (o.phone ? ' · ' + o.phone : ''))).join('');
    select.value = selected;
    renderLines();
  }
  function renderLines() {
    $('#posLines').innerHTML = lines.map((line, i) => '<fieldset class="store-sale-line"><legend>Item ' + (i + 1) + '</legend>' +
      '<label>Product<select class="input" data-line="' + i + '" data-key="productId">' + option('', 'Custom item / unbooked service') + D.PRODUCTS.map(p => option(p.id, p.name + ' · ' + D.money(p.price) + ' · ' + p.stock + ' in stock')).join('') + '</select></label>' +
      (!line.productId ? '<label>Description<input class="input" data-line="' + i + '" data-key="label" maxlength="120" value="' + esc(line.label) + '"></label><label>Unit price<input class="input" type="number" min="0.01" step="0.01" data-line="' + i + '" data-key="amount" value="' + esc(line.amount) + '"></label>' : '') +
      '<label>Quantity<input class="input" type="number" min="1" max="9999" step="1" data-line="' + i + '" data-key="qty" value="' + esc(line.qty) + '"></label><button class="mini-btn danger" type="button" data-remove="' + i + '">Remove item ' + (i + 1) + '</button></fieldset>').join('');
    document.querySelectorAll('[data-key="productId"]').forEach(s => { s.value = lines[Number(s.dataset.line)].productId; });
    sum();
  }
  function sum() {
    const total = lines.reduce((n, l) => n + Number(l.qty || 0) * Number(l.productId ? D.PRODUCT_BY_ID[l.productId]?.price || 0 : l.amount || 0), 0);
    $('#posTotal').textContent = D.money(total);
    $('#posCashField').hidden = $('#posMethod').value !== 'Cash';
  }
  function mountPOS() {
    $('#posLines').addEventListener('input', e => {
      if (!e.target.dataset.key) return;
      lines[Number(e.target.dataset.line)][e.target.dataset.key] = e.target.value;
      if (e.target.dataset.key === 'productId') renderLines(); else sum();
    });
    $('#posLines').addEventListener('click', e => {
      const button = e.target.closest('[data-remove]');
      if (!button || busy) return;
      lines.splice(Number(button.dataset.remove), 1); renderLines();
    });
    $('#posAddLine').addEventListener('click', () => { if (!busy) { lines.push({productId: '', label: '', amount: '', qty: 1}); renderLines(); } });
    $('#posMethod').addEventListener('change', sum);
    $('#posForm').addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      const form = e.target;
      const payload = {ownerId: $('#posOwner').value, lines: lines.map(l => ({...l})), method: $('#posMethod').value,
        options: {requestId, reference: $('#posReference').value, tendered: $('#posTendered').value}};
      busy = true;
      form.querySelectorAll('input, select, button').forEach(x => x.disabled = true);
      try {
        const result = await D.posCharge(payload.ownerId, payload.lines, payload.method, payload.options);
        if (result.error) throw new Error(result.error);
        const orderId = result.order?.id || result.orderId;
        $('#posMsg').textContent = 'Payment recorded: ' + D.money(result.total) + ' · ' + orderId;
        requestId = token(); lines = [{productId: '', label: '', amount: '', qty: 1}];
        form.reset(); renderPOS(); saved();
        if (orderId) showReceipt(orderId);
      } catch (error) { $('#posMsg').textContent = error.message; }
      finally { busy = false; form.querySelectorAll('input, select, button').forEach(x => x.disabled = false); }
    });
  }
  function dialog(title, body) {
    $('#storeDialog')?.remove();
    const element = document.createElement('dialog');
    element.id = 'storeDialog'; element.className = 'store-dialog';
    element.innerHTML = '<div class="store-document"><h2>' + esc(title) + '</h2>' + body + '</div><form method="dialog" class="store-dialog-actions"><button class="btn btn-ghost">Close</button></form>';
    document.body.appendChild(element); element.showModal();
    element.addEventListener('close', () => element.remove());
    return element;
  }
  function showReceipt(id) {
    const order = D.byId(D.db.orders, id);
    if (!order) return;
    const owner = D.byId(D.db.owners, order.ownerId);
    const cms = D.db.cms || {};
    const element = dialog('In-store receipt', '<p><b>' + esc(cms.siteName || 'Paws & Claws') + '</b><br>' + esc(cms.address || '') + '<br>' + esc(cms.phone || '') + '</p>' +
      '<p>' + esc(order.id) + ' · ' + esc(order.placedAt) + '<br>' + esc(owner?.fullName || 'Walk-in customer') + '</p>' +
      '<table class="adm-table"><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>' + order.items.map(x => '<tr><td>' + esc(x.label || D.PRODUCT_BY_ID[x.productId]?.name || x.productId) + '</td><td>' + x.qty + '</td><td>' + D.money(x.price * x.qty) + '</td></tr>').join('') + '</tbody></table>' +
      '<p><b>Total ' + D.money(order.total) + '</b><br>Paid ' + D.money(order.total) + ' · ' + esc(order.method || '') + (order.reference ? '<br>Reference: ' + esc(order.reference) : '') + (order.method === 'Cash' ? '<br>Received ' + D.money(order.tendered ?? order.total) + ' · Change ' + D.money(order.change || 0) : '') + (order.refunded ? '<br>Refunded ' + D.money(order.refunded) + ' · Net received ' + D.money(order.paid) : '') + '</p><p>Thank you for visiting our store.</p><button class="btn btn-teal store-print" type="button">Print receipt</button>');
    element.querySelector('.store-print').onclick = () => window.print();
  }
  function renderBookingForm() {
    const host = $('#storeBookingHost');
    host.hidden = !D.can('bookings.manage');
    if (host.hidden || host.querySelector('form')) return;
    host.innerHTML = '<details><summary>Create an in-store / phone appointment</summary><p>Register the customer and pet in Customers & Pets first. Vaccine and availability checks apply to every appointment. Payment is recorded separately after collection.</p><form id="storeBookingForm">' +
      '<div class="field"><label for="storeCustomer">Customer</label><select class="input" id="storeCustomer" required></select></div>' +
      '<div class="field"><label for="storePet">Pet</label><select class="input" id="storePet" required></select></div>' +
      '<div class="field"><label for="storeService">Service</label><select class="input" id="storeService" required></select></div>' +
      '<div class="field"><label for="storeDate">Date</label><input class="input" id="storeDate" type="date" min="' + D.todayISO() + '" required></div>' +
      '<div class="field"><label for="storeSlot">Available time / specialist</label><select class="input" id="storeSlot" required></select></div><p id="storeBookingPrice" class="hint"></p>' +
      '<button class="btn btn-teal" type="submit">Create appointment</button><p role="status" id="storeBookingMsg"></p></form></details>';
    const refreshCustomers = () => {
      const previous = $('#storeCustomer').value;
      $('#storeCustomer').innerHTML = option('', 'Choose a customer') + D.db.owners.map(o => option(o.id, o.fullName)).join('');
      $('#storeCustomer').value = previous;
      pets();
    };
    const pets = () => { $('#storePet').innerHTML = option('', 'Choose a pet') + D.db.pets.filter(p => p.ownerId === $('#storeCustomer').value).map(p => option(p.id, p.petName)).join(''); };
    const slots = () => {
      const service = D.SERVICES.find(x => x.id === $('#storeService').value);
      $('#storeBookingPrice').textContent = service ? 'Service total: ' + D.money(service.price) + (service.deposit ? ' · Deposit due: ' + D.money(Math.round(service.price * D.DEPOSIT_RATE * 100) / 100) : '') : '';
      const available = service && $('#storeDate').value ? D.slotsFor(D.db, service.id, $('#storeDate').value).filter(s => s.available) : [];
      $('#storeSlot').innerHTML = option('', available.length ? 'Choose a time' : 'No times available — choose another date or service') + available.map(s => option(s.providerId + '|' + s.hour, D.fmtTime(s.hour) + ' · ' + s.providerId)).join('');
    };
    $('#storeService').innerHTML = option('', 'Choose a service') + D.SERVICES.filter(s => s.duration < 24).map(s => option(s.id, s.name)).join('');
    host.querySelector('details').addEventListener('toggle', e => { if (e.target.open) refreshCustomers(); });
    $('#storeCustomer').onchange = pets;
    $('#storeService').onchange = slots; $('#storeDate').onchange = slots;
    refreshCustomers(); slots();
    $('#storeBookingForm').onsubmit = async e => {
      e.preventDefault(); const button = e.target.querySelector('button'); if (button.disabled) return;
      const [providerId, hour] = $('#storeSlot').value.split('|');
      const input = {ownerId: $('#storeCustomer').value, petId: $('#storePet').value, serviceId: $('#storeService').value, date: $('#storeDate').value, providerId, hour: Number(hour)};
      button.disabled = true;
      try {
        const result = await D.staffBooking(input); if (result.error) throw new Error(result.error);
        $('#storeBookingMsg').textContent = 'Appointment created: ' + (result.booking?.id || result.bookingId) + '. Record any payment after it is received.';
        slots(); saved();
      } catch (error) { $('#storeBookingMsg').textContent = error.message; }
      finally { button.disabled = false; }
    };
  }
  document.addEventListener('submit', async e => {
    if (e.target.id !== 'storePetForm') return;
    e.preventDefault(); const form = e.target, button = form.querySelector('button'); if (button.disabled) return;
    const input = Object.fromEntries(new FormData(form)); button.disabled = true;
    try { const r = await D.addPet(input.ownerId, input); if (r.error) throw new Error(r.error); saved(); window.PNC?.toast('Pet registered. Staff can now create an appointment.'); }
    catch (error) { form.querySelector('[role="status"]').textContent = error.message; }
    finally { button.disabled = false; }
  });
  document.addEventListener('click', e => {
    const vaccine = e.target.closest('[data-store-vaccine]');
    if (vaccine) {
      const pet = D.byId(D.db.pets, vaccine.dataset.storeVaccine);
      if (!pet) return;
      const element = dialog('Vaccine record for ' + pet.petName, '<form id="storeVaccineForm"><label>Vaccine<select class="input" name="name">' + D.VACCINES.map(x => option(x,x)).join('') + '</select></label><label>Date administered<input class="input" name="date" type="date" max="' + D.todayISO() + '" required></label><label>Record / lot reference<input class="input" name="lot" maxlength="120"></label><p>Save the record, then review it before approving it for appointments.</p><button class="btn btn-teal" type="submit">Save vaccine record</button><p role="status"></p></form>');
      element.querySelector('form').onsubmit = async event => {
        event.preventDefault(); const form = event.target, button = form.querySelector('button'); if (button.disabled) return;
        const input = Object.fromEntries(new FormData(form)); button.disabled = true;
        try { const r = await D.addVaccine(pet.id, input.name, input.date, input.lot); if (r.error) throw new Error(r.error); element.close(); saved(); }
        catch (error) { form.querySelector('[role="status"]').textContent = error.message; button.disabled = false; }
      };
      return;
    }
    const receipt = e.target.closest('[data-receipt]'); if (receipt) showReceipt(receipt.dataset.receipt);
    const refund = e.target.closest('[data-store-refund]');
    if (refund) {
      const order = D.byId(D.db.orders, refund.dataset.storeRefund);
      if (!order || !order.paid) return;
      const refundId = token();
      const element = dialog('Record an in-store refund', '<p>' + esc(order.id) + ' · Up to ' + D.money(order.paid) + ' can be refunded.</p><form id="storeRefundForm"><label>Amount already refunded to customer<input class="input" name="amount" type="number" step="0.01" min="0.01" max="' + order.paid + '" value="' + order.paid + '" required></label><label>Method<select class="input" name="method">' + methods + '</select></label><label>Reason<input class="input" name="reason" maxlength="500" required></label><p>Give the customer their refund first, then record it here. Returned stock is adjusted separately in Inventory.</p><button class="btn btn-teal" type="submit">Record completed refund</button><p role="status"></p></form>');
      element.querySelector('form').onsubmit = async event => {
        event.preventDefault(); const form = event.target, button = form.querySelector('button'); if (button.disabled) return;
        const input = Object.fromEntries(new FormData(form)); button.disabled = true;
        try { const r = await D.refundStoreSale(order.id, Number(input.amount), input.method, {requestId: refundId, reason: input.reason}); if (r.error) throw new Error(r.error); element.close(); saved(); }
        catch (error) { form.querySelector('[role="status"]').textContent = error.message; button.disabled = false; }
      };
      return;
    }
    const pay = e.target.closest('[data-bkpay]'); if (!pay) return;
    const booking = D.byId(D.db.bookings, pay.dataset.bkpay); if (!booking) return;
    const remaining = Math.round((booking.total - booking.paid) * 100) / 100;
    const paymentId = token();
    const element = dialog('Record appointment payment', '<p>' + esc(booking.id) + ' · Outstanding ' + D.money(remaining) + '</p><form id="storeBookingPayment"><label>Amount received<input class="input" name="amount" type="number" step="0.01" min="0.01" max="' + remaining + '" value="' + remaining + '" required></label><label>Method<select class="input" name="method">' + methods + '</select></label><label>Reference (optional)<input class="input" name="reference" maxlength="120"></label><p>Confirm the payment has been collected. This does not charge a card.</p><button type="submit" class="btn btn-teal">Record received payment</button><p role="status"></p></form>');
    element.querySelector('#storeBookingPayment').onsubmit = async event => {
      event.preventDefault(); const form = event.target, button = form.querySelector('button'); if (button.disabled) return;
      const input = Object.fromEntries(new FormData(form)); button.disabled = true;
      try { const r = await D.recordBookingPayment(booking.id, Number(input.amount), input.method, {requestId: paymentId, reference: input.reference}); if (r.error) throw new Error(r.error); element.close(); saved(); }
      catch (error) { form.querySelector('[role="status"]').textContent = error.message; button.disabled = false; }
    };
  });
  window.PNC_STORE = {renderPOS, mountPOS, renderBookingForm};
})();
