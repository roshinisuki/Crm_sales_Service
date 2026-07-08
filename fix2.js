const fs = require('fs');
let content = fs.readFileSync('components/dashboards/SalesWidgets.tsx', 'utf-8');

const searchStr = `                    </td>
    let type: "Call" | "Email" | "Meeting" | "Proposal" | "Task" = "Call";`;

const replacementStr = `                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function ActionRequiredWidget({ followUps = [] }: { followUps?: any[] }) {
  const mapped = (followUps || []).map((f, idx) => {
    const remarksLower = (f.remarks || "").toLowerCase();
    let type: "Call" | "Email" | "Meeting" | "Proposal" | "Task" = "Call";`;

if (content.includes(searchStr)) {
  content = content.replace(searchStr, replacementStr);
  fs.writeFileSync('components/dashboards/SalesWidgets.tsx', content);
  console.log('Fixed RecentLeadsTableWidget and ActionRequiredWidget boundary.');
} else {
  console.log('Could not find the broken string to replace. Checking alternative...');
}
