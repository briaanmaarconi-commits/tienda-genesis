import { pgTable, unique, uuid, text, timestamp, foreignKey, jsonb, numeric, integer, index, boolean, serial, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const appRole = pgEnum("app_role", ['admin', 'user'])
export const discountType = pgEnum("discount_type", ['percentage', 'fixed'])
export const saleSource = pgEnum("sale_source", ['admin', 'public'])
export const saleStatus = pgEnum("sale_status", ['pendiente', 'confirmada', 'enviada', 'entregada', 'cancelada', 'abonado'])



export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	googleSub: text("google_sub").notNull(),
	email: text("email").notNull(),
	name: text("name"),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		usersGoogleSubKey: unique("users_google_sub_key").on(table.googleSub),
	}
});

export const adminSessions = pgTable("admin_sessions", {
	id: text("id").primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		adminSessionsUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "admin_sessions_user_id_fkey"
		}).onDelete("cascade"),
	}
});

export const userRoles = pgTable("user_roles", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	role: appRole("role").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		userRolesUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_fkey"
		}).onDelete("cascade"),
		userRolesUserIdRoleKey: unique("user_roles_user_id_role_key").on(table.role, table.userId),
	}
});

export const siteSettings = pgTable("site_settings", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	siteName: text("site_name").default('Mi Tienda').notNull(),
	logoUrl: text("logo_url"),
	phone: text("phone"),
	email: text("email"),
	whatsapp: text("whatsapp"),
	instagramUrl: text("instagram_url"),
	facebookUrl: text("facebook_url"),
	address: text("address"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	shippingOriginPostalCode: text("shipping_origin_postal_code"),
	aboutContent: text("about_content"),
	infoContent: text("info_content"),
	infoFaqs: jsonb("info_faqs").default([]),
	adminNotifyEmail: text("admin_notify_email"),
	transferAlias: text("transfer_alias"),
	transferHolder: text("transfer_holder"),
	transferCbu: text("transfer_cbu"),
	transferBank: text("transfer_bank"),
	transferNotes: text("transfer_notes"),
	employeeProfitPct: numeric("employee_profit_pct").default('0').notNull(),
});

export const categories = pgTable("categories", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	slug: text("slug").notNull(),
	name: text("name").notNull(),
	description: text("description").default(''),
	imageUrl: text("image_url"),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		categoriesSlugKey: unique("categories_slug_key").on(table.slug),
	}
});

export const productPacks = pgTable("product_packs", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	units: integer("units"),
	price: numeric("price").default('0').notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	label: text("label"),
	photosRequired: integer("photos_required"),
	compareAtPrice: numeric("compare_at_price"),
	saleStartsAt: timestamp("sale_starts_at", { withTimezone: true, mode: 'string' }),
	saleEndsAt: timestamp("sale_ends_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		idxProductPacksProduct: index("idx_product_packs_product").using("btree", table.productId.asc().nullsLast()),
		productPacksProductIdFkey: foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_packs_product_id_fkey"
		}).onDelete("cascade"),
	}
});

export const paymentMethods = pgTable("payment_methods", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	name: text("name").notNull(),
	surchargePct: numeric("surcharge_pct").default('0').notNull(),
	active: boolean("active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	provider: text("provider").default('manual').notNull(),
});

export const customers = pgTable("customers", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	name: text("name").notNull(),
	phone: text("phone"),
	email: text("email"),
	address: text("address"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const saleItems = pgTable("sale_items", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	saleId: uuid("sale_id").notNull(),
	productId: uuid("product_id"),
	productName: text("product_name").notNull(),
	unitPrice: numeric("unit_price").default('0').notNull(),
	quantity: integer("quantity").default(1).notNull(),
	subtotal: numeric("subtotal").default('0').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	customStickerConfig: jsonb("custom_sticker_config"),
	addons: jsonb("addons"),
	photos: jsonb("photos"),
	unitCost: numeric("unit_cost").default('0').notNull(),
},
(table) => {
	return {
		idxSaleItemsSaleId: index("idx_sale_items_sale_id").using("btree", table.saleId.asc().nullsLast()),
		saleItemsSaleIdFkey: foreignKey({
			columns: [table.saleId],
			foreignColumns: [sales.id],
			name: "sale_items_sale_id_fkey"
		}).onDelete("cascade"),
		saleItemsProductIdFkey: foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "sale_items_product_id_fkey"
		}).onDelete("set null"),
	}
});

export const products = pgTable("products", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	slug: text("slug").notNull(),
	name: text("name").notNull(),
	description: text("description").default(''),
	price: numeric("price", { precision: 12, scale:  2 }).default('0').notNull(),
	categoryId: uuid("category_id"),
	stock: integer("stock").default(0).notNull(),
	featured: boolean("featured").default(false).notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	compareAtPrice: numeric("compare_at_price"),
	saleStartsAt: timestamp("sale_starts_at", { withTimezone: true, mode: 'string' }),
	saleEndsAt: timestamp("sale_ends_at", { withTimezone: true, mode: 'string' }),
	weightKg: numeric("weight_kg").default('0.5').notNull(),
	lengthCm: numeric("length_cm").default('10').notNull(),
	widthCm: numeric("width_cm").default('10').notNull(),
	heightCm: numeric("height_cm").default('10').notNull(),
	productType: text("product_type").default('standard').notNull(),
	cost: numeric("cost").default('0').notNull(),
},
(table) => {
	return {
		categoryIdx: index("products_category_idx").using("btree", table.categoryId.asc().nullsLast()),
		productsCategoryIdFkey: foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "products_category_id_fkey"
		}).onDelete("set null"),
		productsSlugKey: unique("products_slug_key").on(table.slug),
	}
});

export const productImages = pgTable("product_images", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	url: text("url").notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	focalX: numeric("focal_x").default('50').notNull(),
	focalY: numeric("focal_y").default('50').notNull(),
	zoom: numeric("zoom").default('1').notNull(),
	fit: text("fit").default('cover').notNull(),
},
(table) => {
	return {
		productIdx: index("product_images_product_idx").using("btree", table.productId.asc().nullsLast()),
		productImagesProductIdFkey: foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_images_product_id_fkey"
		}).onDelete("cascade"),
	}
});

export const coupons = pgTable("coupons", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	code: text("code").notNull(),
	discountType: discountType("discount_type").default('percentage').notNull(),
	discountValue: numeric("discount_value").default('0').notNull(),
	minOrderTotal: numeric("min_order_total"),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	usageLimit: integer("usage_limit"),
	timesUsed: integer("times_used").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		couponsCodeKey: unique("coupons_code_key").on(table.code),
	}
});

export const banners = pgTable("banners", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	title: text("title").default('').notNull(),
	subtitle: text("subtitle").default(''),
	ctaText: text("cta_text").default(''),
	ctaHref: text("cta_href").default('/'),
	imageUrl: text("image_url"),
	bgColor: text("bg_color").default('#0ea5e9'),
	sortOrder: integer("sort_order").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	focalX: numeric("focal_x").default('50').notNull(),
	focalY: numeric("focal_y").default('50').notNull(),
	zoom: numeric("zoom").default('1').notNull(),
	fit: text("fit").default('cover').notNull(),
	hideTextMobile: boolean("hide_text_mobile").default(false).notNull(),
});

export const shippingMethods = pgTable("shipping_methods", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	name: text("name").notNull(),
	cost: numeric("cost").default('0').notNull(),
	active: boolean("active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	provider: text("provider").default('manual').notNull(),
	tipo: text("tipo"),
	rateMode: text("rate_mode").default('fixed').notNull(),
	deliveryType: text("delivery_type").default('domicilio').notNull(),
	estimatedTime: text("estimated_time"),
	pickupHours: text("pickup_hours"),
});

export const productStickerFolders = pgTable("product_sticker_folders", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	name: text("name").notNull(),
	slug: text("slug"),
	sortOrder: integer("sort_order").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxStickerFoldersProduct: index("idx_sticker_folders_product").using("btree", table.productId.asc().nullsLast()),
		productStickerFoldersProductIdFkey: foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_sticker_folders_product_id_fkey"
		}).onDelete("cascade"),
	}
});

export const productStickers = pgTable("product_stickers", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	folderId: uuid("folder_id").notNull(),
	name: text("name").notNull(),
	imageUrl: text("image_url"),
	sortOrder: integer("sort_order").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxStickersFolder: index("idx_stickers_folder").using("btree", table.folderId.asc().nullsLast()),
		productStickersFolderIdFkey: foreignKey({
			columns: [table.folderId],
			foreignColumns: [productStickerFolders.id],
			name: "product_stickers_folder_id_fkey"
		}).onDelete("cascade"),
	}
});

export const shippingRates = pgTable("shipping_rates", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	shippingMethodId: uuid("shipping_method_id").notNull(),
	province: text("province"),
	postalCodeFrom: text("postal_code_from"),
	postalCodeTo: text("postal_code_to"),
	cost: numeric("cost").default('0').notNull(),
	freeFromAmount: numeric("free_from_amount"),
	active: boolean("active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxShippingRatesMethod: index("idx_shipping_rates_method").using("btree", table.shippingMethodId.asc().nullsLast()),
		shippingRatesShippingMethodIdFkey: foreignKey({
			columns: [table.shippingMethodId],
			foreignColumns: [shippingMethods.id],
			name: "shipping_rates_shipping_method_id_fkey"
		}).onDelete("cascade"),
	}
});

export const productAddonGroups = pgTable("product_addon_groups", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	name: text("name").notNull(),
	required: boolean("required").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	perUnit: boolean("per_unit").default(false).notNull(),
	isMultiplier: boolean("is_multiplier").default(false).notNull(),
},
(table) => {
	return {
		productAddonGroupsProductIdFkey: foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_addon_groups_product_id_fkey"
		}).onDelete("cascade"),
	}
});

export const stickerShapes = pgTable("sticker_shapes", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	name: text("name").notNull(),
	icon: text("icon"),
	sortOrder: integer("sort_order").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const freeShippingRules = pgTable("free_shipping_rules", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	shippingMethodId: uuid("shipping_method_id"),
	minAmount: numeric("min_amount").default('0').notNull(),
	province: text("province"),
	postalCodeFrom: text("postal_code_from"),
	postalCodeTo: text("postal_code_to"),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		freeShippingRulesShippingMethodIdFkey: foreignKey({
			columns: [table.shippingMethodId],
			foreignColumns: [shippingMethods.id],
			name: "free_shipping_rules_shipping_method_id_fkey"
		}).onDelete("cascade"),
	}
});

export const localDeliveryZones = pgTable("local_delivery_zones", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	shippingMethodId: uuid("shipping_method_id").notNull(),
	name: text("name").notNull(),
	postalCodes: text("postal_codes").array().default([""]).notNull(),
	cost: numeric("cost").default('0').notNull(),
	estimatedTime: text("estimated_time"),
	active: boolean("active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		localDeliveryZonesShippingMethodIdFkey: foreignKey({
			columns: [table.shippingMethodId],
			foreignColumns: [shippingMethods.id],
			name: "local_delivery_zones_shipping_method_id_fkey"
		}).onDelete("cascade"),
	}
});

export const stickerMaterials = pgTable("sticker_materials", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	name: text("name").notNull(),
	basePrice: numeric("base_price").default('0').notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const stickerFinishes = pgTable("sticker_finishes", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	name: text("name").notNull(),
	surcharge: numeric("surcharge").default('0').notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const stickerSizes = pgTable("sticker_sizes", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	label: text("label").notNull(),
	widthCm: numeric("width_cm").default('0').notNull(),
	heightCm: numeric("height_cm").default('0').notNull(),
	priceMultiplier: numeric("price_multiplier").default('1').notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const stickerQuantities = pgTable("sticker_quantities", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	quantity: integer("quantity").notNull(),
	discountPct: numeric("discount_pct").default('0').notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const sales = pgTable("sales", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	customerId: uuid("customer_id"),
	paymentMethodId: uuid("payment_method_id"),
	shippingMethodId: uuid("shipping_method_id"),
	subtotal: numeric("subtotal").default('0').notNull(),
	shippingCost: numeric("shipping_cost").default('0').notNull(),
	surcharge: numeric("surcharge").default('0').notNull(),
	total: numeric("total").default('0').notNull(),
	status: saleStatus("status").default('pendiente').notNull(),
	source: saleSource("source").default('admin').notNull(),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	couponCode: text("coupon_code"),
	discountAmount: numeric("discount_amount").default('0').notNull(),
	mpPreferenceId: text("mp_preference_id"),
	mpPaymentId: text("mp_payment_id"),
	mpStatus: text("mp_status"),
	orderNumber: serial("order_number").notNull(),
	shippingPostalCode: text("shipping_postal_code"),
	shippingAddressExtra: text("shipping_address_extra"),
	andreaniBranchId: text("andreani_branch_id"),
	andreaniTrackingNumber: text("andreani_tracking_number"),
	andreaniLabelUrl: text("andreani_label_url"),
	andreaniStatus: text("andreani_status"),
	shippingProvince: text("shipping_province"),
	shippingLocality: text("shipping_locality"),
	shippingBranchId: text("shipping_branch_id"),
	shippingBranchName: text("shipping_branch_name"),
	trackingCode: text("tracking_code"),
	trackingCarrier: text("tracking_carrier"),
},
(table) => {
	return {
		idxSalesCreatedAt: index("idx_sales_created_at").using("btree", table.createdAt.desc().nullsFirst()),
		idxSalesStatus: index("idx_sales_status").using("btree", table.status.asc().nullsLast()),
		salesCustomerIdFkey: foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "sales_customer_id_fkey"
		}).onDelete("set null"),
		salesPaymentMethodIdFkey: foreignKey({
			columns: [table.paymentMethodId],
			foreignColumns: [paymentMethods.id],
			name: "sales_payment_method_id_fkey"
		}).onDelete("set null"),
		salesShippingMethodIdFkey: foreignKey({
			columns: [table.shippingMethodId],
			foreignColumns: [shippingMethods.id],
			name: "sales_shipping_method_id_fkey"
		}).onDelete("set null"),
		salesOrderNumberKey: unique("sales_order_number_key").on(table.orderNumber),
	}
});

export const sharedCarts = pgTable("shared_carts", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	token: text("token").notNull(),
	customerName: text("customer_name"),
	customerPhone: text("customer_phone"),
	notes: text("notes"),
	items: jsonb("items").notNull(),
	status: text("status").default('pendiente').notNull(),
	saleId: uuid("sale_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		sharedCartsTokenKey: unique("shared_carts_token_key").on(table.token),
		sharedCartsSaleIdFkey: foreignKey({
			columns: [table.saleId],
			foreignColumns: [sales.id],
			name: "shared_carts_sale_id_fkey"
		}).onDelete("set null"),
	}
});

export const productAddonOptions = pgTable("product_addon_options", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	groupId: uuid("group_id").notNull(),
	name: text("name").notNull(),
	extraPrice: numeric("extra_price").default('0').notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	priceMultiplier: numeric("price_multiplier").default('1').notNull(),
},
(table) => {
	return {
		productAddonOptionsGroupIdFkey: foreignKey({
			columns: [table.groupId],
			foreignColumns: [productAddonGroups.id],
			name: "product_addon_options_group_id_fkey"
		}).onDelete("cascade"),
	}
});

export const siteSettingsPublic = pgTable("site_settings_public", {
	id: uuid("id"),
	siteName: text("site_name"),
	logoUrl: text("logo_url"),
	phone: text("phone"),
	email: text("email"),
	whatsapp: text("whatsapp"),
	instagramUrl: text("instagram_url"),
	facebookUrl: text("facebook_url"),
	address: text("address"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	shippingOriginPostalCode: text("shipping_origin_postal_code"),
	aboutContent: text("about_content"),
	infoContent: text("info_content"),
	infoFaqs: jsonb("info_faqs"),
});

export const expenses = pgTable("expenses", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	category: text("category").notNull(),
	description: text("description"),
	amount: numeric("amount").notNull(),
	expenseDate: date("expense_date").default(sql`CURRENT_DATE`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});