import { createRoute } from "honox/factory";
import { AdminPanel } from "../../components/admin-panel.js";
import { Layout, Title } from "../../components/ui.js";

export default createRoute((c) => {
  return c.render(
    <Layout>
      <Title>Admin</Title>
      <AdminPanel>
        <p>この枠のスタイルは admin ルートの CSS にだけ含まれる。</p>
      </AdminPanel>
    </Layout>,
    { title: "Admin | bestcss × HonoX" },
  );
});
