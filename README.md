# PositionManager MVP

一个纯前端的仓位计划小工具原型，满足以下规则：
- 仅大分类设置目标比例（计划内总和需 100%）
- 个股只录入实际持仓金额
- 自动维护 `exception/其他` 分类用于计划外持仓
- 实时计算分类剩余仓位与全局超配状态

## 快速启动

```bash
python3 -m http.server 4173
```

浏览器打开：`http://localhost:4173`
