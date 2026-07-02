async function ensureMemberSelected() {
  const storedId = localStorage.getItem('selectedMemberId');
  const storedName = localStorage.getItem('selectedMemberName');

  if (storedId && storedName) {
    window.currentMember = { id: storedId, name: storedName };
    // Still load full member list for place split selection
    try {
      const members = await loadMembers();
      window.members = members;
    } catch {
      window.members = [];
    }
    return;
  }

  let members;
  try {
    members = await loadMembers();
    window.members = members;
  } catch {
    alert('ไม่สามารถโหลดรายชื่อสมาชิกได้ กรุณาลองใหม่');
    location.reload();
    return;
  }

  if (!members.length) {
    alert('ไม่พบรายชื่อสมาชิก กรุณาลองใหม่');
    location.reload();
    return;
  }

  const splash = document.getElementById('splash');
  if (splash) splash.classList.add('hidden');

  const modal = document.getElementById('selection-modal');
  const list = document.getElementById('selection-list');

  list.textContent = '';

  return new Promise((resolve) => {
    members.forEach((m, i) => {
      const btn = el('button', 'member-btn');
      const avatar = el('span', `member-avatar avatar-c${i % 4}`, m.name.charAt(0));
      const label = el('span', 'member-name', m.name);
      append(btn, avatar, label);
      btn.onclick = () => {
        localStorage.setItem('selectedMemberId', m.id);
        localStorage.setItem('selectedMemberName', m.name);
        window.currentMember = { id: m.id, name: m.name };
        modal.classList.add('hidden');
        const splash = document.getElementById('splash');
        if (splash) splash.classList.remove('hidden');
        resolve();
      };
      append(list, btn);
    });

    modal.classList.remove('hidden');
  });
}
