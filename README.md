# Tiến độ mục tiêu tuyển sinh · Engonow

Trang theo dõi tiến độ KPI tuyển sinh cho các phòng ban của Engonow. Trang chỉ có tỷ lệ % so với mục tiêu và bình quân thu mỗi học viên mới. Không có số tiền tổng, số học viên hay mục tiêu tuyệt đối.

- `index.html`, `app.js`: giao diện và biểu đồ (d3).
- `dash-lite.js`: phần chạy trang, đọc dữ liệu trong `data/`.
- `data/kpi.json`: từng kỳ KPI (06 đến hết 05 tháng sau) và ba chỉ số của mỗi kỳ.
- `data/daily.json`: doanh thu mới cộng dồn theo ngày của từng kỳ, tính bằng % mục tiêu.

Dữ liệu được cập nhật định kỳ từ sheet KPI nội bộ của Khối Vận hành. Không sửa tay các file trong `data/`.

Hồ sơ theo dõi KPI (EO-QMS-SOP-KPI-01) · Khối Vận hành Engonow.
