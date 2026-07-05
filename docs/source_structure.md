# Estructura del Proyecto 

```text
Listado de rutas de carpetas
El número de serie del volumen es 0000016D F0D5:DDDE
C:\USERS\DELL\DOCUMENTS\PROYECTOS\SSRFINAN\SRC
|   app.ts
|   server.ts
|   
+---cache
|       cache-accounts.service.ts
|       cache-categories.service.ts
|       cache-category-groups.service.ts
|       cache-home.service.ts
|       cache-key.service.ts
|       cache-payable-groups.service.ts
|       cache-payable-payments.service.ts
|       cache-payables.service.ts
|       cache.service.ts
|       
+---config
|       genhash.js
|       rate-limiter.ts
|       session-store.ts
|       typeorm-decimal.transformer.ts
|       typeorm.datasource.ts
|       typeorm.logger.ts
|       
+---controllers
|   +---account
|   |       account.controller.ts
|   |       account.saving.ts
|   |       account.validator.ts
|   |       
|   +---category
|   |       category.controller.ts
|   |       category.saving.ts
|   |       category.validator.ts
|   |       
|   +---category-group
|   |       category-group.controller.ts
|   |       category-group.saving.ts
|   |       category-group.validator.ts
|   |       
|   +---home
|   |       2fa.controller.ts
|   |       home.auxiliar.ts
|   |       home.controller.ts
|   |       
|   +---payable
|   |       payable.controller.ts
|   |       payable.saving.ts
|   |       payable.validator.ts
|   |       
|   +---payable-group
|   |       payable-group.controller.ts
|   |       payable-group.saving.ts
|   |       payable-group.validator.ts
|   |       
|   +---payable-payment
|   |       payable-payment.controller.ts
|   |       payable-payment.saving.ts
|   |       payable-payment.validator.ts
|   |       
|   \---transaction
|           batch-categorize.controller.ts
|           transaction.auxiliar.ts
|           transaction.controller.ts
|           transaction.saving.ts
|           transaction.validator.ts
|           
+---entities
|       Account.entity.ts
|       AuthCode.entity.ts
|       CacheKpiBalance.entity.ts
|       CacheKpiCategory.entity.ts
|       Category.entity.ts
|       CategoryGroups.entity.ts
|       Payable.entity.ts
|       PayableGroup.entity.ts
|       PayablePayment.entity.ts
|       Receivable.entity.ts
|       ReceivableCollection.entity.ts
|       ReceivableGroup.entity.ts
|       Transaction.entity.ts
|       User.entity.ts
|       
+---middlewares
|       csrf.middleware.ts
|       inject-net-balance.middleware.ts
|       inject-payable-balance.middleware.ts
|       logger.middleware.ts
|       session-auth.middleware.ts
|       
+---policies
|       account-form.policy.ts
|       category-form.policy.ts
|       category-group-form.policy.ts
|       payable-form.policy.ts
|       payable-group-form.policy.ts
|       payable-payment-form.policy.ts
|       roles-user.policy.ts
|       transaction-form.policy.ts
|       
+---public
|   +---css
|   |   |   app.css
|   |   |   output.css
|   |   |   ui-login.css
|   |   |   
|   |   +---base
|   |   |       breakpoints.css
|   |   |       layout.css
|   |   |       variables.css
|   |   |       
|   |   +---components
|   |   |       amounts.css
|   |   |       autocomplete.css
|   |   |       buttons.css
|   |   |       cards.css
|   |   |       icon-buttons.css
|   |   |       modal.css
|   |   |       search.css
|   |   |       tables.css
|   |   |       tags.css
|   |   |       
|   |   \---modules
|   |           accounts.css
|   |           carousel.css
|   |           categories.css
|   |           dashboard.css
|   |           loan-payments.css
|   |           loans.css
|   |           navbar.css
|   |           transactions.css
|   |           
|   \---js
|       +---forms
|       |       account-form.js
|       |       autocomplete-form.js
|       |       category-form.js
|       |       category-group-form.js
|       |       loan-form.js
|       |       loan-payment-form.js
|       |       transactions-form.js
|       |       
|       +---helpers
|       |       amount-helper.js
|       |       autocomplete-helper.js
|       |       format-datetime-helper.js
|       |       icon-helper.js
|       |       logger-helper.js
|       |       message-box-helper.js
|       |       status-toggle-helper.js
|       |       storage-helper.js
|       |       timezone-helper.js
|       |       type-tags-helper.js
|       |       
|       +---indexes
|       |       accounts-index.js
|       |       batch-categorize-index.js
|       |       categories-index.js
|       |       home-index.js
|       |       loan-payments-index.js
|       |       loans-index.js
|       |       transactions-batch-categorize-index.js
|       |       transactions-index.js
|       |       
|       \---vendor
|           +---chart.js
|           |   \---global
|           |       |   chart.cjs
|           |       |   chart.cjs.map
|           |       |   chart.js
|           |       |   chart.js.map
|           |       |   chart.umd.js
|           |       |   chart.umd.js.map
|           |       |   chart.umd.min.js
|           |       |   chart.umd.min.js.map
|           |       |   helpers.cjs
|           |       |   helpers.cjs.map
|           |       |   helpers.js
|           |       |   helpers.js.map
|           |       |   index.d.ts
|           |       |   index.umd.d.ts
|           |       |   types.d.ts
|           |       |   
|           |       +---chunks
|           |       |       helpers.dataset.cjs
|           |       |       helpers.dataset.cjs.map
|           |       |       helpers.dataset.js
|           |       |       helpers.dataset.js.map
|           |       |       
|           |       +---controllers
|           |       |       controller.bar.d.ts
|           |       |       controller.bubble.d.ts
|           |       |       controller.doughnut.d.ts
|           |       |       controller.line.d.ts
|           |       |       controller.pie.d.ts
|           |       |       controller.polarArea.d.ts
|           |       |       controller.radar.d.ts
|           |       |       controller.scatter.d.ts
|           |       |       index.d.ts
|           |       |       
|           |       +---core
|           |       |       core.adapters.d.ts
|           |       |       core.animation.d.ts
|           |       |       core.animations.d.ts
|           |       |       core.animations.defaults.d.ts
|           |       |       core.animator.d.ts
|           |       |       core.config.d.ts
|           |       |       core.controller.d.ts
|           |       |       core.datasetController.d.ts
|           |       |       core.defaults.d.ts
|           |       |       core.element.d.ts
|           |       |       core.interaction.d.ts
|           |       |       core.layouts.d.ts
|           |       |       core.layouts.defaults.d.ts
|           |       |       core.plugins.d.ts
|           |       |       core.registry.d.ts
|           |       |       core.scale.autoskip.d.ts
|           |       |       core.scale.d.ts
|           |       |       core.scale.defaults.d.ts
|           |       |       core.ticks.d.ts
|           |       |       core.typedRegistry.d.ts
|           |       |       index.d.ts
|           |       |       
|           |       +---elements
|           |       |       element.arc.d.ts
|           |       |       element.bar.d.ts
|           |       |       element.line.d.ts
|           |       |       element.point.d.ts
|           |       |       index.d.ts
|           |       |       
|           |       +---helpers
|           |       |       helpers.canvas.d.ts
|           |       |       helpers.collection.d.ts
|           |       |       helpers.color.d.ts
|           |       |       helpers.config.d.ts
|           |       |       helpers.config.types.d.ts
|           |       |       helpers.core.d.ts
|           |       |       helpers.curve.d.ts
|           |       |       helpers.dataset.d.ts
|           |       |       helpers.dom.d.ts
|           |       |       helpers.easing.d.ts
|           |       |       helpers.extras.d.ts
|           |       |       helpers.interpolation.d.ts
|           |       |       helpers.intl.d.ts
|           |       |       helpers.math.d.ts
|           |       |       helpers.options.d.ts
|           |       |       helpers.rtl.d.ts
|           |       |       helpers.segment.d.ts
|           |       |       index.d.ts
|           |       |       
|           |       +---platform
|           |       |       index.d.ts
|           |       |       platform.base.d.ts
|           |       |       platform.basic.d.ts
|           |       |       platform.dom.d.ts
|           |       |       
|           |       +---plugins
|           |       |   |   index.d.ts
|           |       |   |   plugin.colors.d.ts
|           |       |   |   plugin.decimation.d.ts
|           |       |   |   plugin.legend.d.ts
|           |       |   |   plugin.subtitle.d.ts
|           |       |   |   plugin.title.d.ts
|           |       |   |   plugin.tooltip.d.ts
|           |       |   |   
|           |       |   \---plugin.filler
|           |       |           filler.drawing.d.ts
|           |       |           filler.helper.d.ts
|           |       |           filler.options.d.ts
|           |       |           filler.segment.d.ts
|           |       |           filler.target.d.ts
|           |       |           filler.target.stack.d.ts
|           |       |           index.d.ts
|           |       |           simpleArc.d.ts
|           |       |           
|           |       +---scales
|           |       |       index.d.ts
|           |       |       scale.category.d.ts
|           |       |       scale.linear.d.ts
|           |       |       scale.linearbase.d.ts
|           |       |       scale.logarithmic.d.ts
|           |       |       scale.radialLinear.d.ts
|           |       |       scale.time.d.ts
|           |       |       scale.timeseries.d.ts
|           |       |       
|           |       \---types
|           |               animation.d.ts
|           |               basic.d.ts
|           |               color.d.ts
|           |               geometric.d.ts
|           |               index.d.ts
|           |               layout.d.ts
|           |               utils.d.ts
|           |               
|           \---lunox
|               \---global
|                       luxon.js
|                       luxon.js.map
|                       luxon.min.js
|                       luxon.min.js.map
|                       
+---routes
|       account.route.ts
|       auth.route.ts
|       category-group.route.ts
|       category.route.ts
|       home.route.ts
|       payable-group.route.ts
|       payable-payment.route.ts
|       payable.route.ts
|       transaction.route.ts
|       
+---services
|       account-balance.service.ts
|       kpi-cache.service.ts
|       next-valid-trx-date.service.ts
|       payable-balance.service.ts
|       payable-payment-number.service.ts
|       populate-items.service.ts
|       send-2fa-mail.service.ts
|       send-2fa.service.ts
|       
+---types
|       auth-request.d.ts
|       express-mysql-session.d.ts
|       express-session.d.ts
|       form-view-params.d.ts
|       
+---utils
|       auth-code.util.ts
|       bool.util.ts
|       date.util.ts
|       error.util.ts
|       logger.util.ts
|       req-params.util.ts
|       sql-err.util.ts
|       
+---validators
|       map-errors.validator.ts
|       not-same-account.validator.ts
|       
\---views
    +---layouts
    |       main.ejs
    |       
    +---pages
    |   |   2fa.ejs
    |   |   about.ejs
    |   |   home.ejs
    |   |   login.ejs
    |   |   
    |   +---accounts
    |   |       form.ejs
    |   |       index.ejs
    |   |       
    |   +---categories
    |   |       form.ejs
    |   |       index.ejs
    |   |       
    |   +---category-groups
    |   |       form.ejs
    |   |       
    |   +---loan-groups
    |   |       form.ejs
    |   |       
    |   +---loan-payments
    |   |       form.ejs
    |   |       index.ejs
    |   |       
    |   +---loans
    |   |       form.ejs
    |   |       index.ejs
    |   |       
    |   \---transactions
    |           batch-categorize.ejs
    |           form.ejs
    |           index.ejs
    |           
    \---partials
            btn-accept-batch.ejs
            btn-back.ejs
            btn-cancel-batch.ejs
            btn-categorize-batch.ejs
            btn-filter.ejs
            btn-new.ejs
            btn-recalculate.ejs
            btn-toggle-status.ejs
            navbar.ejs
            search-box.ejs
            ui-modal.ejs
ECHO est  desactivado.
```
