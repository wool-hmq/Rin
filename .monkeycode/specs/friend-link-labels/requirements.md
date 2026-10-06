# Requirements Document: Friend Link Groups

## Introduction

为友链系统增加分组功能。分组由管理员在后台设置页面统一维护；友链归属于某个分组，留空默认归入"朋友们"分组。"朋友们"分组为系统内置默认分组，始终存在、不可删除、不可改名。友链页面按分组展示已接受的友链，分组显示顺序可配置。

## Glossary

- **分组（Group）**: 友链的分类容器，名称唯一，由管理员在后台设置页面增删改名。
- **内置默认分组**: 名称为"朋友们"的分组，系统内置，不可删除、不可改名。
- **分组显示顺序（group order）**: 管理员在设置页面配置的分组在友链页面的展示顺序。
- **健康友链（Healthy Friend）**: friends 表 health 列为空字符串的友链。
- **已接受友链（Accepted Friend）**: friends 表 accepted 字段为 1 的友链。

## Requirements

### Requirement 1: 后台分组管理设置项

**User Story:** AS 系统管理员, I want 在后台设置页面增加一个分组管理设置项, so that 我可以创建、重命名、删除友链分组

#### Acceptance Criteria

1. WHEN 管理员打开后台设置页面友链区域时, 系统 SHALL 显示分组管理设置项，列出当前所有分组名称
2. WHEN 管理员在分组设置项中输入新分组名称并提交时, 系统 SHALL 创建该分组
3. WHEN 管理员修改某个分组名称时, 系统 SHALL 更新该分组名称
4. WHEN 管理员删除某个非"朋友们"分组时, 系统 SHALL 删除该分组
5. WHEN 管理员尝试删除"朋友们"分组时, 系统 SHALL 拒绝删除
6. WHEN 管理员创建与已有分组同名的分组时, 系统 SHALL 拒绝创建

### Requirement 2: 分组显示顺序设置项

**User Story:** AS 系统管理员, I want 设置分组在友链页面的显示顺序, so that 我可以控制各分组的前后展示

#### Acceptance Criteria

1. WHEN 后台设置页面存在两个及以上分组时, 系统 SHALL 显示分组排序设置项
2. WHEN 管理员通过上/下按钮调整分组顺序时, 系统 SHALL 即时更新排序配置
3. WHEN 新增一个分组时, 系统 SHALL 将新分组默认插入到"朋友们"分组之后
4. WHEN 排序设置项中的分组数量与分组列表不一致时, 系统 SHALL 以分组列表为准补齐排序项

### Requirement 3: 友链编辑弹窗分组设置

**User Story:** AS 管理员, I want 在友链编辑弹窗中设置该友链的分组, so that 我可以把友链归入不同分组

#### Acceptance Criteria

1. WHEN 管理员打开友链编辑弹窗时, 系统 SHALL 显示分组选择项，候选值为当前所有分组
2. WHEN 管理员不填写分组或清空分组时, 系统 SHALL 将该友链归入"朋友们"分组
3. WHEN 管理员选择某个分组并保存时, 系统 SHALL 将该分组值提交到后端并持久化
4. WHEN 管理员选择的分组后续被删除时, 系统 SHALL 在展示时将该友链回退归入"朋友们"分组

### Requirement 4: 友链页面分组展示

**User Story:** AS 访客, I want 友链页面按分组展示友链, so that 我可以按分类浏览友链

#### Acceptance Criteria

1. WHEN 访客访问友链页面时, 系统 SHALL 按以下区块顺序展示：正常友链分组（按设置中的自定义排序）、暂时离开、待审核、拒绝
2. WHEN 某分组下存在已接受且健康的友链时, 系统 SHALL 展示该分组及其友链
3. WHEN 某分组下不存在已接受且健康的友链时, 系统 SHALL 不展示该分组
4. WHEN 友链的分组为空或指向已删除的分组时, 系统 SHALL 将其归入"朋友们"分组展示
5. WHEN 友链的 accepted 不为 1 时, 系统 SHALL 将其放入待审核或拒绝区块，不参与分组展示
6. WHEN 友链的 health 不为空且 accepted 为 1 时, 系统 SHALL 将其放入"暂时离开"区块，不参与分组展示

### Requirement 5: 数据持久化

**User Story:** AS 系统, I want 分组与友链归属被持久化, so that 重启后配置不丢失

#### Acceptance Criteria

1. WHEN 系统存储分组列表时, 系统 SHALL 使用客户端配置键 `friend_groups`（JSON 数组）持久化
2. WHEN 系统存储分组显示顺序时, 系统 SHALL 使用客户端配置键 `friend_group_order`（JSON 数组）持久化
3. WHEN 系统存储友链分组归属时, 系统 SHALL 在 friends 表的 `group` 列持久化
4. WHEN 创建/更新友链时, 系统 SHALL 接受可选的 `group` 字段
