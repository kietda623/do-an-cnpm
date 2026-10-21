# Task Ownership and Budget Allocation

Ngày chỉnh: 2026-10-20. 158 task chưa thực hiện; 64 WBS giữ nguyên tổng 157 person-day.

## Quy tắc

- Mỗi task có một Owner chính, một Reviewer độc lập và Sprint(s) của phần việc có effort. Nếu có nhiều Sprint, mỗi allocation ghi riêng phần cần làm ở từng Sprint; kiểm chứng phần đó theo milestone, không đợi task đóng toàn bộ.
- Budget của WBS được chia cho các task có WBS đó làm nguồn chính. Bảy work package đóng góp vào task phối hợp được gán rõ ở bảng dưới. Các liên kết WBS còn lại là reference=0.00PD, không phải effort phát sinh hoặc contributor thứ hai ngầm định.
- Phân bổ đến 0.01 PD, phần lẻ theo thứ tự ID; đây là chia ngân sách kế toán, không là ước lượng độ chính xác đến phút. Task thực tế cần thêm thời gian phải reforecast, không tự tăng budget.
- Tổng allocation từng WBS, từng contributor/Sprint và toàn nhóm bằng baseline gốc. Không cộng task allocation vào 157 PD WBS lần nữa.
- W032 chỉ được cấp cho T130: M5/Sprint4, reviewer M3, 2.00PD. Các task Mobile S6 dùng W048, không chi W032 lần nữa.

## Phân công và đóng góp

| Task | Owner | Reviewer | Sprint(s) | Allocation theo contributor / WBS / Sprint | Tổng PD |
| --- | --- | --- | --- | --- | --- |
| T001 | M1 | M3 | S1 | W001: 2.00 PD — M1/S1 | 2.00 |
| T002 | M1 | M2 | S1 | W002: 2.00 PD — M1/S1 | 2.00 |
| T003 | M2 | M1 | S1 | W003: 2.50 PD — M2/S1 | 2.50 |
| T004 | M5 | M4 | S1 | W008: 1.50 PD — M5/S1 | 1.50 |
| T005 | M3 | M4 | S1 | W005: 3.50 PD — M3/S1; W006: 3.50 PD — M4/S1 | 7.00 |
| T006 | M5 | M2 | S1 | W007: 2.00 PD — M5/S1 | 2.00 |
| T007 | M2 | M4 | S1 | W004: 1.00 PD — M2/S1 | 1.00 |
| T008 | M2 | M3 | S2 | W017: 0.25 PD — M2/S2 | 0.25 |
| T009 | M2 | M3 | S2 | W017: 0.25 PD — M2/S2 | 0.25 |
| T010 | M5 | M2 | S2 | W016: 0.40 PD — M5/S2 | 0.40 |
| T011 | M5 | M2 | S2 | W016: 0.40 PD — M5/S2; W058: reference, 0.00 PD | 0.40 |
| T012 | M2 | M1 | S2 | W011: 0.67 PD — M2/S2 | 0.67 |
| T013 | M2 | M1 | S2 | W011: 0.67 PD — M2/S2; W012: reference, 0.00 PD | 0.67 |
| T014 | M2 | M1 | S2 | W011: 0.66 PD — M2/S2 | 0.66 |
| T015 | M1 | M5 | S2 | W010: 1.00 PD — M1/S2; W002: reference, 0.00 PD | 1.00 |
| T016 | M2 | M5 | S2 | W012: 0.67 PD — M2/S2; W019: reference, 0.00 PD | 0.67 |
| T017 | M5 | M1 | S2 | W015: 0.40 PD — M5/S2; W007: reference, 0.00 PD | 0.40 |
| T018 | M3 | M1 | S2 | W013: 1.34 PD — M3/S2; W014: reference, 0.00 PD | 1.34 |
| T019 | M2 | M4 | S1 | W004: 1.00 PD — M2/S1; W013: reference, 0.00 PD | 1.00 |
| T020 | M5 | M2 | S2 | W016: 0.40 PD — M5/S2 | 0.40 |
| T021 | M5 | M2 | S2 | W016: 0.40 PD — M5/S2; W033: reference, 0.00 PD | 0.40 |
| T022 | M5 | M2 | S2 | W016: 0.40 PD — M5/S2; W017: reference, 0.00 PD | 0.40 |
| T023 | M5 | M1 | S2 | W015: 0.40 PD — M5/S2; W024: reference, 0.00 PD | 0.40 |
| T024 | M5 | M1 | S2 | W015: 0.40 PD — M5/S2; W025: reference, 0.00 PD | 0.40 |
| T025 | M5 | M1 | S2 | W015: 0.40 PD — M5/S2 | 0.40 |
| T026 | M1 | M2 | S2 | W009: 0.50 PD — M1/S2 | 0.50 |
| T027 | M1 | M2 | S2 | W009: 0.50 PD — M1/S2; W010: reference, 0.00 PD | 0.50 |
| T028 | M2 | M5 | S2 | W012: 0.67 PD — M2/S2 | 0.67 |
| T029 | M5 | M2 | S3 | W024: 1.00 PD — M5/S3 | 1.00 |
| T030 | M1 | M2 | S2 | W009: 0.50 PD — M1/S2; W012: reference, 0.00 PD | 0.50 |
| T031 | M1 | M2 | S2 | W009: 0.50 PD — M1/S2; W010: reference, 0.00 PD | 0.50 |
| T032 | M1 | M5 | S2 | W010: 1.00 PD — M1/S2 | 1.00 |
| T033 | M2 | M5 | S2 | W012: 0.66 PD — M2/S2; W013: reference, 0.00 PD | 0.66 |
| T034 | M5 | M2 | S3 | W024: 1.00 PD — M5/S3 | 1.00 |
| T035 | M1 | M2 | S2 | W009: 0.50 PD — M1/S2; W010: reference, 0.00 PD; W012: reference, 0.00 PD; W024: reference, 0.00 PD | 0.50 |
| T036 | M3 | M1 | S2 | W013: 1.33 PD — M3/S2; W014: reference, 0.00 PD | 1.33 |
| T037 | M3 | M1 | S2 | W013: 1.33 PD — M3/S2 | 1.33 |
| T038 | M4 | M1 | S2 | W014: 3.50 PD — M4/S2 | 3.50 |
| T039 | M5 | M1 | S2 | W015: 0.40 PD — M5/S2; W016: reference, 0.00 PD | 0.40 |
| T040 | M1 | M4 | S3 | W018: 0.42 PD — M1/S3; W025: reference, 0.00 PD | 0.42 |
| T041 | M1 | M4 | S3 | W018: 0.42 PD — M1/S3; W025: reference, 0.00 PD | 0.42 |
| T042 | M1 | M4 | S3 | W018: 0.42 PD — M1/S3 | 0.42 |
| T043 | M1 | M4 | S3 | W018: 0.42 PD — M1/S3 | 0.42 |
| T044 | M1 | M4 | S3 | W018: 0.41 PD — M1/S3 | 0.41 |
| T045 | M1 | M4 | S3 | W018: 0.41 PD — M1/S3 | 0.41 |
| T046 | M4 | M1 | S3 | W023: 0.80 PD — M4/S3 | 0.80 |
| T047 | M4 | M1 | S3 | W023: 0.80 PD — M4/S3 | 0.80 |
| T048 | M5 | M1 | S3 | W025: 1.00 PD — M5/S3 | 1.00 |
| T049 | M2 | M1 | S3 | W020: 0.50 PD — M2/S3; W021: reference, 0.00 PD; W025: reference, 0.00 PD | 0.50 |
| T050 | M2 | M1 | S3 | W020: 0.50 PD — M2/S3; W021: reference, 0.00 PD; W025: reference, 0.00 PD | 0.50 |
| T051 | M4 | M1 | S3 | W023: 0.80 PD — M4/S3; W025: reference, 0.00 PD | 0.80 |
| T052 | M1 | M2 | S3 | W019: 0.38 PD — M1/S3 | 0.38 |
| T053 | M2 | M1 | S3 | W020: 0.50 PD — M2/S3 | 0.50 |
| T054 | M2 | M1 | S3 | W020: 0.50 PD — M2/S3 | 0.50 |
| T055 | M2 | M5 | S3 | W021: 1.00 PD — M2/S3 | 1.00 |
| T056 | M1 | M2 | S3 | W019: 0.38 PD — M1/S3; W020: reference, 0.00 PD; W021: reference, 0.00 PD | 0.38 |
| T057 | M1 | M2 | S3 | W019: 0.37 PD — M1/S3 | 0.37 |
| T058 | M2 | M5 | S3 | W021: 1.00 PD — M2/S3 | 1.00 |
| T059 | M2 | M1 | S3 | W020: 0.50 PD — M2/S3 | 0.50 |
| T060 | M1 | M2 | S3 | W019: 0.37 PD — M1/S3; W020: reference, 0.00 PD; W021: reference, 0.00 PD | 0.37 |
| T061 | M4 | M1 | S3, S4 | W023: 0.80 PD — M4/S3; W031: 4.00 PD — M4/S4 | 4.80 |
| T062 | M4 | M1 | S3 | W023: 0.80 PD — M4/S3 | 0.80 |
| T063 | M5 | M1 | S3 | W025: 1.00 PD — M5/S3 | 1.00 |
| T064 | M2 | M3 | S4 | W028: 0.67 PD — M2/S4; W033: reference, 0.00 PD | 0.67 |
| T065 | M2 | M3 | S4 | W028: 0.67 PD — M2/S4 | 0.67 |
| T066 | M2 | M3 | S4 | W028: 0.66 PD — M2/S4 | 0.66 |
| T067 | M3 | M2 | S3 | W022: 1.34 PD — M3/S3; W028: reference, 0.00 PD | 1.34 |
| T068 | M3 | M2 | S3 | W022: 1.33 PD — M3/S3; W030: reference, 0.00 PD | 1.33 |
| T069 | M3 | M2 | S3 | W022: 1.33 PD — M3/S3 | 1.33 |
| T070 | M3 | M2 | S4 | W030: 2.00 PD — M3/S4; W033: 2.00 PD — M5/S4 | 4.00 |
| T071 | M1 | M3 | S4 | W026: 0.50 PD — M1/S4; W027: 2.00 PD — M1/S4; W033: reference, 0.00 PD | 2.50 |
| T072 | M2 | M1 | S4 | W029: 1.00 PD — M2/S4; W035: reference, 0.00 PD | 1.00 |
| T073 | M2 | M1 | S4 | W029: 1.00 PD — M2/S4; W040: reference, 0.00 PD | 1.00 |
| T074 | M1 | M3 | S4 | W026: 0.50 PD — M1/S4 | 0.50 |
| T075 | M2 | M1 | S5 | W035: 0.42 PD — M2/S5 | 0.42 |
| T076 | M2 | M1 | S5 | W035: 0.42 PD — M2/S5 | 0.42 |
| T077 | M2 | M1 | S5 | W035: 0.42 PD — M2/S5; W036: reference, 0.00 PD | 0.42 |
| T078 | M1 | M3 | S4 | W026: 0.50 PD — M1/S4; W035: reference, 0.00 PD | 0.50 |
| T079 | M1 | M3 | S4 | W026: 0.50 PD — M1/S4 | 0.50 |
| T080 | M2 | M1 | S5 | W035: 0.42 PD — M2/S5 | 0.42 |
| T081 | M2 | M1 | S5 | W035: 0.41 PD — M2/S5 | 0.41 |
| T082 | M2 | M1 | S5 | W035: 0.41 PD — M2/S5 | 0.41 |
| T083 | M1 | M3 | S4 | W026: 0.50 PD — M1/S4; W035: reference, 0.00 PD | 0.50 |
| T084 | M3 | M2 | S4 | W030: 2.00 PD — M3/S4 | 2.00 |
| T085 | M3 | M1 | S5 | W038: 1.00 PD — M3/S5 | 1.00 |
| T086 | M3 | M1 | S5 | W038: 1.00 PD — M3/S5 | 1.00 |
| T087 | M5 | M2 | S5 | W040: 0.63 PD — M5/S5; W041: reference, 0.00 PD | 0.63 |
| T088 | M2 | M1 | S5 | W036: 0.29 PD — M2/S5; W040: reference, 0.00 PD | 0.29 |
| T089 | M1 | M2 | S5 | W034: 0.50 PD — M1/S5; W036: reference, 0.00 PD | 0.50 |
| T090 | M5 | M2 | S5 | W040: 0.63 PD — M5/S5 | 0.63 |
| T091 | M2 | M1 | S5 | W036: 0.29 PD — M2/S5 | 0.29 |
| T092 | M2 | M1 | S5 | W036: 0.29 PD — M2/S5 | 0.29 |
| T093 | M1 | M2 | S5 | W034: 0.50 PD — M1/S5; W036: reference, 0.00 PD | 0.50 |
| T094 | M2 | M1 | S5 | W036: 0.29 PD — M2/S5 | 0.29 |
| T095 | M1 | M2 | S5 | W034: 0.50 PD — M1/S5 | 0.50 |
| T096 | M2 | M1 | S5 | W036: 0.28 PD — M2/S5 | 0.28 |
| T097 | M2 | M1 | S5 | W036: 0.28 PD — M2/S5; W044: reference, 0.00 PD | 0.28 |
| T098 | M1 | M2 | S5 | W034: 0.50 PD — M1/S5; W036: reference, 0.00 PD | 0.50 |
| T099 | M3 | M1 | S5 | W038: 1.00 PD — M3/S5 | 1.00 |
| T100 | M5 | M2 | S5 | W040: 0.62 PD — M5/S5; W041: reference, 0.00 PD | 0.62 |
| T101 | M1 | M4 | S5 | W037: 0.40 PD — M1/S5; W040: reference, 0.00 PD | 0.40 |
| T102 | M1 | M4 | S5 | W037: 0.40 PD — M1/S5; W040: reference, 0.00 PD | 0.40 |
| T103 | M1 | M4 | S5 | W037: 0.40 PD — M1/S5 | 0.40 |
| T104 | M1 | M2 | S5 | W034: 0.50 PD — M1/S5; W037: reference, 0.00 PD | 0.50 |
| T105 | M1 | M4 | S5 | W037: 0.40 PD — M1/S5 | 0.40 |
| T106 | M2 | M1 | S5 | W036: 0.28 PD — M2/S5; W037: reference, 0.00 PD | 0.28 |
| T107 | M1 | M4 | S5 | W037: 0.40 PD — M1/S5 | 0.40 |
| T108 | M4 | M1 | S5 | W039: 2.00 PD — M4/S5 | 2.00 |
| T109 | M3 | M1 | S5 | W038: 1.00 PD — M3/S5 | 1.00 |
| T110 | M4 | M1 | S5 | W039: 2.00 PD — M4/S5 | 2.00 |
| T111 | M5 | M2 | S5 | W040: 0.62 PD — M5/S5; W041: 1.50 PD — M5/S5 | 2.12 |
| T112 | M1 | M3 | S6 | W043: 0.40 PD — M1/S6; W044: reference, 0.00 PD | 0.40 |
| T113 | M1 | M3 | S6 | W043: 0.40 PD — M1/S6; W044: reference, 0.00 PD; W045: reference, 0.00 PD | 0.40 |
| T114 | M1 | M3 | S6 | W043: 0.40 PD — M1/S6 | 0.40 |
| T115 | M1 | M3 | S6 | W043: 0.40 PD — M1/S6 | 0.40 |
| T116 | M2 | M4 | S6 | W044: 2.00 PD — M2/S6 | 2.00 |
| T117 | M1 | M3 | S6 | W043: 0.40 PD — M1/S6; W044: reference, 0.00 PD | 0.40 |
| T118 | M3 | M5 | S6 | W046: 4.00 PD — M3/S6 | 4.00 |
| T119 | M4 | M5 | S6 | W047: 1.00 PD — M4/S6 | 1.00 |
| T120 | M2 | M1 | S6 | W045: 1.00 PD — M2/S6; W046: reference, 0.00 PD | 1.00 |
| T121 | M1 | M4 | S6 | W042: 0.40 PD — M1/S6; W045: reference, 0.00 PD | 0.40 |
| T122 | M1 | M4 | S6 | W042: 0.40 PD — M1/S6; W045: reference, 0.00 PD; W050: reference, 0.00 PD | 0.40 |
| T123 | M1 | M4 | S6 | W042: 0.40 PD — M1/S6 | 0.40 |
| T124 | M1 | M4 | S6 | W042: 0.40 PD — M1/S6 | 0.40 |
| T125 | M2 | M1 | S6 | W045: 1.00 PD — M2/S6 | 1.00 |
| T126 | M1 | M4 | S6 | W042: 0.40 PD — M1/S6; W045: reference, 0.00 PD | 0.40 |
| T127 | M4 | M5 | S6 | W047: 1.00 PD — M4/S6 | 1.00 |
| T128 | M4 | M5 | S6 | W047: 1.00 PD — M4/S6 | 1.00 |
| T129 | M1 | M5 | S7 | W050: 1.25 PD — M1/S7; W051: reference, 0.00 PD; W056: reference, 0.00 PD | 1.25 |
| T130 | M5 | M3 | S4 | W032: 2.00 PD — M5/S4 | 2.00 |
| T131 | M5 | M1 | S6 | W049: 0.25 PD — M5/S6 | 0.25 |
| T132 | M5 | M3 | S6 | W048: 0.50 PD — M5/S6; W054: reference, 0.00 PD; W055: reference, 0.00 PD | 0.50 |
| T133 | M5 | M3 | S6 | W048: 0.50 PD — M5/S6 | 0.50 |
| T134 | M5 | M3 | S6 | W048: 0.50 PD — M5/S6 | 0.50 |
| T135 | M5 | M3 | S6 | W048: 0.50 PD — M5/S6 | 0.50 |
| T136 | M5 | M3 | S6 | W048: 0.50 PD — M5/S6 | 0.50 |
| T137 | M5 | M3 | S6 | W048: 0.50 PD — M5/S6 | 0.50 |
| T138 | M3 | M5 | S7 | W054: 2.00 PD — M3/S7 | 2.00 |
| T139 | M5 | M1 | S6 | W049: 0.25 PD — M5/S6; W054: reference, 0.00 PD; W056: reference, 0.00 PD | 0.25 |
| T140 | M4 | M5 | S6 | W047: 1.00 PD — M4/S6; W055: reference, 0.00 PD | 1.00 |
| T141 | M5 | M1 | S6 | W049: 0.25 PD — M5/S6; W055: reference, 0.00 PD | 0.25 |
| T142 | M4 | M5 | S7 | W055: 1.34 PD — M4/S7 | 1.34 |
| T143 | M4 | M5 | S7 | W055: 1.33 PD — M4/S7 | 1.33 |
| T144 | M4 | M5 | S7 | W055: 1.33 PD — M4/S7; W057: reference, 0.00 PD | 1.33 |
| T145 | M5 | M1 | S6 | W049: 0.25 PD — M5/S6; W056: reference, 0.00 PD; W062: reference, 0.00 PD | 0.25 |
| T146 | M1 | M5 | S7 | W050: 1.25 PD — M1/S7 | 1.25 |
| T147 | M2 | M1 | S7 | W052: 3.00 PD — M2/S7 | 3.00 |
| T148 | M3 | M5 | S7 | W054: 2.00 PD — M3/S7 | 2.00 |
| T149 | M2 | M5 | S7 | W053: 1.00 PD — M2/S7 | 1.00 |
| T150 | M2 | M1 | S8 | W059: 2.00 PD — M2/S8 | 2.00 |
| T151 | M1 | M4 | S7 | W051: 1.50 PD — M1/S7 | 1.50 |
| T152 | M5 | M2 | S7, S8 | W057: 1.50 PD — M5/S7; W060: 1.00 PD — M2/S8 | 2.50 |
| T153 | M5 | M2 | S8 | W063: 1.00 PD — M5/S8 | 1.00 |
| T154 | M1 | M3 | S8 | W058: 3.00 PD — M1/S8 | 3.00 |
| T155 | M3 | M4 | S8 | W061: 3.00 PD — M3/S8; W062: 3.00 PD — M4/S8 | 6.00 |
| T156 | M5 | M2 | S8 | W063: 1.00 PD — M5/S8 | 1.00 |
| T157 | M5 | M3 | S7 | W056: 2.50 PD — M5/S7; W064: reference, 0.00 PD | 2.50 |
| T158 | M5 | M1 | S8 | W064: 1.50 PD — M5/S8 | 1.50 |

## Kiểm toán WBS

| WBS | Owner | Sprint | Ngân sách gốc PD | Task allocation PD |
| --- | --- | --- | --- | --- |
| W001 | M1 | S1 | 2.00 | 2.00 |
| W002 | M1 | S1 | 2.00 | 2.00 |
| W003 | M2 | S1 | 2.50 | 2.50 |
| W004 | M2 | S1 | 2.00 | 2.00 |
| W005 | M3 | S1 | 3.50 | 3.50 |
| W006 | M4 | S1 | 3.50 | 3.50 |
| W007 | M5 | S1 | 2.00 | 2.00 |
| W008 | M5 | S1 | 1.50 | 1.50 |
| W009 | M1 | S2 | 2.50 | 2.50 |
| W010 | M1 | S2 | 2.00 | 2.00 |
| W011 | M2 | S2 | 2.00 | 2.00 |
| W012 | M2 | S2 | 2.00 | 2.00 |
| W013 | M3 | S2 | 4.00 | 4.00 |
| W014 | M4 | S2 | 3.50 | 3.50 |
| W015 | M5 | S2 | 2.00 | 2.00 |
| W016 | M5 | S2 | 2.00 | 2.00 |
| W017 | M2 | S2 | 0.50 | 0.50 |
| W018 | M1 | S3 | 2.50 | 2.50 |
| W019 | M1 | S3 | 1.50 | 1.50 |
| W020 | M2 | S3 | 2.50 | 2.50 |
| W021 | M2 | S3 | 2.00 | 2.00 |
| W022 | M3 | S3 | 4.00 | 4.00 |
| W023 | M4 | S3 | 4.00 | 4.00 |
| W024 | M5 | S3 | 2.00 | 2.00 |
| W025 | M5 | S3 | 2.00 | 2.00 |
| W026 | M1 | S4 | 2.50 | 2.50 |
| W027 | M1 | S4 | 2.00 | 2.00 |
| W028 | M2 | S4 | 2.00 | 2.00 |
| W029 | M2 | S4 | 2.00 | 2.00 |
| W030 | M3 | S4 | 4.00 | 4.00 |
| W031 | M4 | S4 | 4.00 | 4.00 |
| W032 | M5 | S4 | 2.00 | 2.00 |
| W033 | M5 | S4 | 2.00 | 2.00 |
| W034 | M1 | S5 | 2.50 | 2.50 |
| W035 | M2 | S5 | 2.50 | 2.50 |
| W036 | M2 | S5 | 2.00 | 2.00 |
| W037 | M1 | S5 | 2.00 | 2.00 |
| W038 | M3 | S5 | 4.00 | 4.00 |
| W039 | M4 | S5 | 4.00 | 4.00 |
| W040 | M5 | S5 | 2.50 | 2.50 |
| W041 | M5 | S5 | 1.50 | 1.50 |
| W042 | M1 | S6 | 2.00 | 2.00 |
| W043 | M1 | S6 | 2.00 | 2.00 |
| W044 | M2 | S6 | 2.00 | 2.00 |
| W045 | M2 | S6 | 2.00 | 2.00 |
| W046 | M3 | S6 | 4.00 | 4.00 |
| W047 | M4 | S6 | 4.00 | 4.00 |
| W048 | M5 | S6 | 3.00 | 3.00 |
| W049 | M5 | S6 | 1.00 | 1.00 |
| W050 | M1 | S7 | 2.50 | 2.50 |
| W051 | M1 | S7 | 1.50 | 1.50 |
| W052 | M2 | S7 | 3.00 | 3.00 |
| W053 | M2 | S7 | 1.00 | 1.00 |
| W054 | M3 | S7 | 4.00 | 4.00 |
| W055 | M4 | S7 | 4.00 | 4.00 |
| W056 | M5 | S7 | 2.50 | 2.50 |
| W057 | M5 | S7 | 1.50 | 1.50 |
| W058 | M1 | S8 | 3.00 | 3.00 |
| W059 | M2 | S8 | 2.00 | 2.00 |
| W060 | M2 | S8 | 1.00 | 1.00 |
| W061 | M3 | S8 | 3.00 | 3.00 |
| W062 | M4 | S8 | 3.00 | 3.00 |
| W063 | M5 | S8 | 2.00 | 2.00 |
| W064 | M5 | S8 | 1.50 | 1.50 |

## Kiểm toán capacity theo contributor

| Sprint | M1 | M2 | M3 | M4 | M5 | Tổng PD |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 4.00 | 4.50 | 3.50 | 3.50 | 3.50 | 19.00 |
| 2 | 4.50 | 4.50 | 4.00 | 3.50 | 4.00 | 20.50 |
| 3 | 4.00 | 4.50 | 4.00 | 4.00 | 4.00 | 20.50 |
| 4 | 4.50 | 4.00 | 4.00 | 4.00 | 4.00 | 20.50 |
| 5 | 4.50 | 4.50 | 4.00 | 4.00 | 4.00 | 21.00 |
| 6 | 4.00 | 4.00 | 4.00 | 4.00 | 4.00 | 20.00 |
| 7 | 4.00 | 4.00 | 4.00 | 4.00 | 4.00 | 20.00 |
| 8 | 3.00 | 3.00 | 3.00 | 3.00 | 3.50 | 15.50 |
