path = 'C:/Users/Roshini/Suki-CRM/app/(dashboard)/layout.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '            <ExpandableNavSection label="Activities" icon={<Activity size={17} />} subItems={activitySubItems} pathname={pathname} onNavClick={onNavClick} />\n            <ExpandableNavSection label="Visits"'
new = '            <ExpandableNavSection label="Activities" icon={<Activity size={17} />} subItems={activitySubItems} pathname={pathname} onNavClick={onNavClick} />\n            <NavLink item={{ href: "/contacts", label: "Contacts", icon: <ContactRound size={17} /> }} active={pathname.startsWith("/contacts")} onClick={onNavClick} />\n            <NavLink item={{ href: "/tasks", label: "Tasks", icon: <ListTodo size={17} /> }} active={pathname.startsWith("/tasks")} onClick={onNavClick} />\n            <ExpandableNavSection label="Visits"'

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: Contacts and Tasks added to sidebar')
else:
    # Try with \r\n
    old_crlf = old.replace('\n', '\r\n')
    new_crlf = new.replace('\n', '\r\n')
    if old_crlf in content:
        content = content.replace(old_crlf, new_crlf)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('SUCCESS (CRLF): Contacts and Tasks added to sidebar')
    else:
        # Debug: find Activities line
        idx = content.find('label="Activities"')
        print('Activities label found at:', idx)
        if idx >= 0:
            print('Context around it:')
            print(repr(content[idx-12:idx+160]))
        else:
            print('Not found at all')
