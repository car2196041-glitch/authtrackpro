// Load dashboard from backend
async function loadDashboard() {
  try {
    const res = await fetch('http://localhost:3000/dashboard');
    const data = await res.json();

    document.getElementById('metricPending').textContent = data.pending;
    document.getElementById('metricApproved').textContent = data.approved;
    document.getElementById('metricDenied').textContent = data.denied;

  } catch (error) {
    console.error('Dashboard error:', error);
  }
}

// Load dashboard data
async function loadDashboard() {
  try {
    const res = await fetch('http://localhost:3000/dashboard');
    const data = await res.json();

    console.log('Dashboard:', data);

    // Example: update UI (you can adjust IDs later)
    document.getElementById('total').textContent = data.total;
    document.getElementById('pending').textContent = data.pending;
    document.getElementById('approved').textContent = data.approved;
    document.getElementById('denied').textContent = data.denied;

  } catch (error) {
    console.error('Dashboard error:', error);
  }
}

// Load authorizations into table
async function loadAuthorizations() {
  try {
    const res = await fetch('http://localhost:3000/authorizations');
    const data = await res.json();

    const table = document.getElementById('authTable');
    table.innerHTML = '';

    let dueSoonCount = 0;

 data.forEach(auth => {
  const row = document.createElement('tr');

  const requestDate = new Date(auth.request_date);
  const today = new Date();
  const diffTime = today - requestDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const isDueSoon = auth.status === 'Pending' && diffDays >= 3;

  if (isDueSoon) {
    dueSoonCount++;
  }

  row.innerHTML = `
    <td>${auth.patient_name}</td>
    <td>${auth.insurance}</td>
    <td>${auth.procedure_code}</td>
    <td>${requestDate.toLocaleDateString()}</td>
    <td>${auth.status}</td>
    <td>${isDueSoon ? '⚠️ Due Soon' : 'On Track'}</td>
    <td><button onclick="updateAuth(${auth.id})">Update</button></td>
  `;

  table.appendChild(row);
});

document.getElementById('metricDue').textContent = dueSoonCount;

  } catch (error) {
    console.error('Auth error:', error);
  }
}

document.getElementById('authForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const newAuth = {
    patient_name: document.getElementById('patient').value,
    dob: '1980-01-01',
    insurance: document.getElementById('payer').value,
    procedure_code: document.getElementById('cpt').value,
    status: document.getElementById('status').value,
    request_date: document.getElementById('appt').value,
    auth_number: 'PENDING',
    notes: 'Created from frontend form'
  };

  try {
    const res = await fetch('http://localhost:3000/authorizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAuth)
    });

    const data = await res.json();
    console.log('Created:', data);

    document.getElementById('authForm').reset();

    loadDashboard();
    loadAuthorizations();

  } catch (error) {
    console.error('Create auth error:', error);
  }
});

async function updateAuth(id) {
  const newStatus = prompt('Enter new status (Pending, Approved, Denied):');

  if (!newStatus) return;

  try {
    await fetch(`http://localhost:3000/authorizations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        auth_number: 'UPDATED',
        notes: 'Updated from UI'
      })
    });

    loadDashboard();
    loadAuthorizations();

  } catch (error) {
    console.error('Update error:', error);
  }
}

// Run on page load
window.onload = () => {
  loadDashboard();
  loadAuthorizations();
};
