import { relations } from "drizzle-orm/relations";
import { users, adminSessions, userRoles, products, productPacks, sales, saleItems, categories, productImages, productStickerFolders, productStickers, shippingMethods, shippingRates, productAddonGroups, freeShippingRules, localDeliveryZones, customers, paymentMethods, productAddonOptions } from "./schema.js";

export const adminSessionsRelations = relations(adminSessions, ({one}) => ({
	user: one(users, {
		fields: [adminSessions.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	adminSessions: many(adminSessions),
	userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id]
	}),
}));

export const productPacksRelations = relations(productPacks, ({one}) => ({
	product: one(products, {
		fields: [productPacks.productId],
		references: [products.id]
	}),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	productPacks: many(productPacks),
	saleItems: many(saleItems),
	category: one(categories, {
		fields: [products.categoryId],
		references: [categories.id]
	}),
	productImages: many(productImages),
	productStickerFolders: many(productStickerFolders),
	productAddonGroups: many(productAddonGroups),
}));

export const saleItemsRelations = relations(saleItems, ({one}) => ({
	sale: one(sales, {
		fields: [saleItems.saleId],
		references: [sales.id]
	}),
	product: one(products, {
		fields: [saleItems.productId],
		references: [products.id]
	}),
}));

export const salesRelations = relations(sales, ({one, many}) => ({
	saleItems: many(saleItems),
	customer: one(customers, {
		fields: [sales.customerId],
		references: [customers.id]
	}),
	paymentMethod: one(paymentMethods, {
		fields: [sales.paymentMethodId],
		references: [paymentMethods.id]
	}),
	shippingMethod: one(shippingMethods, {
		fields: [sales.shippingMethodId],
		references: [shippingMethods.id]
	}),
}));

export const categoriesRelations = relations(categories, ({many}) => ({
	products: many(products),
}));

export const productImagesRelations = relations(productImages, ({one}) => ({
	product: one(products, {
		fields: [productImages.productId],
		references: [products.id]
	}),
}));

export const productStickerFoldersRelations = relations(productStickerFolders, ({one, many}) => ({
	product: one(products, {
		fields: [productStickerFolders.productId],
		references: [products.id]
	}),
	productStickers: many(productStickers),
}));

export const productStickersRelations = relations(productStickers, ({one}) => ({
	productStickerFolder: one(productStickerFolders, {
		fields: [productStickers.folderId],
		references: [productStickerFolders.id]
	}),
}));

export const shippingRatesRelations = relations(shippingRates, ({one}) => ({
	shippingMethod: one(shippingMethods, {
		fields: [shippingRates.shippingMethodId],
		references: [shippingMethods.id]
	}),
}));

export const shippingMethodsRelations = relations(shippingMethods, ({many}) => ({
	shippingRates: many(shippingRates),
	freeShippingRules: many(freeShippingRules),
	localDeliveryZones: many(localDeliveryZones),
	sales: many(sales),
}));

export const productAddonGroupsRelations = relations(productAddonGroups, ({one, many}) => ({
	product: one(products, {
		fields: [productAddonGroups.productId],
		references: [products.id]
	}),
	productAddonOptions: many(productAddonOptions),
}));

export const freeShippingRulesRelations = relations(freeShippingRules, ({one}) => ({
	shippingMethod: one(shippingMethods, {
		fields: [freeShippingRules.shippingMethodId],
		references: [shippingMethods.id]
	}),
}));

export const localDeliveryZonesRelations = relations(localDeliveryZones, ({one}) => ({
	shippingMethod: one(shippingMethods, {
		fields: [localDeliveryZones.shippingMethodId],
		references: [shippingMethods.id]
	}),
}));

export const customersRelations = relations(customers, ({many}) => ({
	sales: many(sales),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({many}) => ({
	sales: many(sales),
}));

export const productAddonOptionsRelations = relations(productAddonOptions, ({one}) => ({
	productAddonGroup: one(productAddonGroups, {
		fields: [productAddonOptions.groupId],
		references: [productAddonGroups.id]
	}),
}));